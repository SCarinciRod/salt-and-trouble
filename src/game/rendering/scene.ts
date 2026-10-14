import { Application, Assets, Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js';
import type { Simulation } from '../simulation/world';
import type { Ship } from '../types';
import { ProjectileTrails } from './projectileTrails';

const assetUrls = {
  water: '/assets/png/default/tiles/tile_73.png',
  explosion: '/assets/png/default/effects/explosion_1.png',
  cannonball: '/assets/png/retina/ship_parts/cannon_ball.png',
  player: '/assets/png/retina/ships/ship_2.png',
  playerHurt: '/assets/png/retina/ships/ship_8.png',
  playerCritical: '/assets/png/retina/ships/ship_14.png',
  chaser: '/assets/png/retina/ships/ship_3.png',
  chaserHurt: '/assets/png/retina/ships/ship_9.png',
  chaserCritical: '/assets/png/retina/ships/ship_15.png',
  shooter: '/assets/png/retina/ships/ship_4.png',
  shooterHurt: '/assets/png/retina/ships/ship_10.png',
  shooterCritical: '/assets/png/retina/ships/ship_16.png',
};

export async function loadTextures(onProgress: (progress: number) => void) {
  const files = [
    ...Object.values(assetUrls),
    ...[6, 7, 8, 22, 23, 24, 38, 39, 40].map(
      (tile) => `/assets/png/default/tiles/tile_${tile}.png`,
    ),
  ];
  let loaded = 0;
  await Promise.all(
    files.map(async (url) => {
      await Assets.load<Texture>(url);
      onProgress(Math.round((++loaded / files.length) * 100));
    }),
  );
}

interface ShipView {
  root: Container;
  sprite: Sprite;
  bar: Graphics;
  hp: number;
}

export class BattleScene {
  private readonly ships = new Map<string, ShipView>();
  private readonly bullets = new Map<string, Container>();
  private readonly effects = new Map<string, Sprite | Graphics>();
  private readonly shipLayer = new Container();
  private readonly bulletLayer = new Container();
  private readonly smokeLayer = new Container();
  private readonly smokeViews: Graphics[] = [];
  private readonly trails: ProjectileTrails;
  private readonly effectLayer = new Container();
  private readonly water: TilingSprite;

  constructor(
    private readonly app: Application,
    private readonly world: Simulation,
  ) {
    this.trails = new ProjectileTrails(world.config.visuals.smoke);
    const { width, height } = world.config.arena;
    this.water = new TilingSprite({ texture: Assets.get<Texture>(assetUrls.water), width, height });
    this.water.tint = 0x75baca;
    app.stage.addChild(this.water);
    const grid = new Graphics();
    for (let x = 0; x < width; x += 128) grid.moveTo(x, 0).lineTo(x, height);
    for (let y = 0; y < height; y += 128) grid.moveTo(0, y).lineTo(width, y);
    grid.stroke({ color: 0xffffff, alpha: 0.045, width: 1 });
    app.stage.addChild(grid);
    for (const island of world.config.islands) {
      const tiles = [6, 7, 8, 22, 23, 24, 38, 39, 40];
      const shadow = new Graphics()
        .roundRect(island.x - 6, island.y + 3, island.width + 12, island.height + 12, 22)
        .fill({ color: 0x0b7080, alpha: 0.2 });
      app.stage.addChild(shadow);
      tiles.forEach((tile, index) => {
        const sprite = new Sprite(
          Assets.get<Texture>(`/assets/png/default/tiles/tile_${tile}.png`),
        );
        sprite.position.set(
          island.x + ((index % 3) * island.width) / 3,
          island.y + (Math.floor(index / 3) * island.height) / 3,
        );
        sprite.width = island.width / 3;
        sprite.height = island.height / 3;
        app.stage.addChild(sprite);
      });
    }
    app.stage.addChild(this.smokeLayer, this.shipLayer, this.bulletLayer, this.effectLayer);
  }

  render() {
    this.renderSmoke();
    this.water.tilePosition.set(this.world.elapsed * 3, this.world.elapsed * 2);
    const living = [this.world.player, ...this.world.enemies.filter((enemy) => enemy.hp > 0)];
    const ids = new Set(living.map((ship) => ship.id));
    for (const [id, view] of this.ships)
      if (!ids.has(id)) {
        view.root.destroy({ children: true });
        this.ships.delete(id);
      }
    for (const ship of living) {
      const kind =
        ship.id === 'player'
          ? 'player'
          : this.world.enemies.find((enemy) => enemy.id === ship.id)!.kind;
      const health = ship.hp / ship.maxHp;
      const textureKey =
        `${kind}${health <= 0.33 ? 'Critical' : health <= 0.66 ? 'Hurt' : ''}` as keyof typeof assetUrls;
      let view = this.ships.get(ship.id);
      if (!view) {
        const root = new Container();
        const sprite = new Sprite(Assets.get<Texture>(assetUrls[textureKey]));
        sprite.anchor.set(0.5);
        sprite.width = 32;
        sprite.height = 55;
        const bar = new Graphics();
        root.addChild(sprite, bar);
        this.shipLayer.addChild(root);
        view = { root, sprite, bar, hp: -1 };
        this.ships.set(ship.id, view);
      }
      view.root.position.set(ship.x, ship.y);
      view.sprite.rotation = ship.angle - Math.PI / 2;
      view.sprite.texture = Assets.get<Texture>(assetUrls[textureKey]);
      view.sprite.tint = ship.hp <= 0 ? 0x5d7079 : 0xffffff;
      if (view.hp !== ship.hp) {
        this.healthBar(view.bar, ship);
        view.hp = ship.hp;
      }
    }
    const bulletIds = new Set(this.world.projectiles.map((shot) => shot.id));
    for (const [id, graphic] of this.bullets)
      if (!bulletIds.has(id)) {
        graphic.destroy({ children: true });
        this.bullets.delete(id);
      }
    for (const shot of this.world.projectiles) {
      let graphic = this.bullets.get(shot.id);
      if (!graphic) {
        const diameter = this.world.config.visuals.cannonball.diameter;
        graphic = new Container();
        const shadow = new Graphics()
          .circle(1.5, 2, diameter / 2)
          .fill({ color: 0x083744, alpha: 0.25 });
        const ball = new Sprite(Assets.get<Texture>(assetUrls.cannonball));
        ball.anchor.set(0.5);
        ball.width = diameter;
        ball.height = diameter;
        graphic.addChild(shadow, ball);
        this.bulletLayer.addChild(graphic);
        this.bullets.set(shot.id, graphic);
      }
      graphic.position.set(shot.x, shot.y);
    }
    const effectIds = new Set(this.world.effects.map((effect) => effect.id));
    for (const [id, effect] of this.effects)
      if (!effectIds.has(id)) {
        effect.destroy();
        this.effects.delete(id);
      }
    for (const effect of this.world.effects) {
      let graphic = this.effects.get(effect.id);
      if (!graphic) {
        if (effect.kind === 'explosion') {
          const sprite = new Sprite(Assets.get<Texture>(assetUrls.explosion));
          sprite.anchor.set(0.5);
          sprite.width = 58;
          sprite.height = 58;
          graphic = sprite;
        } else {
          graphic = new Graphics()
            .circle(0, 0, effect.kind === 'shot' ? 9 : 16)
            .fill({ color: effect.kind === 'shot' ? 0xffeea4 : 0xff9060, alpha: 0.8 });
        }
        this.effectLayer.addChild(graphic);
        this.effects.set(effect.id, graphic);
      }
      graphic.position.set(effect.x, effect.y);
      graphic.alpha = Math.min(1, (effect.remaining / effect.duration) * 2);
    }
    this.app.render();
  }

  destroy() {
    this.trails.clear();
    this.smokeViews.length = 0;
    this.ships.clear();
    this.bullets.clear();
    this.effects.clear();
  }

  private renderSmoke() {
    this.trails.update(this.world.projectiles, this.world.elapsed);
    const particles = this.trails.snapshot();
    particles.forEach((particle, index) => {
      let view = this.smokeViews[index];
      if (!view) {
        view = new Graphics()
          .circle(-0.3, 0, 0.8)
          .circle(0.35, -0.2, 0.7)
          .circle(0.1, 0.4, 0.65)
          .fill(0xffffff);
        this.smokeViews.push(view);
        this.smokeLayer.addChild(view);
      }
      view.visible = true;
      view.position.set(particle.x, particle.y);
      view.scale.set(particle.radius);
      view.alpha = particle.alpha;
      view.tint = particle.owner === 'player' ? 0xe3dfd1 : 0xd8bbaa;
    });
    for (let index = particles.length; index < this.smokeViews.length; index++)
      this.smokeViews[index]!.visible = false;
  }

  private healthBar(bar: Graphics, ship: Ship) {
    bar.clear().roundRect(-20, -40, 40, 6, 2).fill({ color: 0x143f45, alpha: 0.9 });
    if (ship.hp > 0)
      bar
        .roundRect(-18, -38, (36 * ship.hp) / ship.maxHp, 2, 1)
        .fill(ship.hp / ship.maxHp > 0.5 ? 0xc4edaa : 0xffad72);
  }
}
