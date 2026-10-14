import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

async function summarize(file) {
  const heap = JSON.parse(gunzipSync(await readFile(file)).toString());
  const fields = heap.snapshot.meta.node_fields;
  const typeAt = fields.indexOf('type');
  const nameAt = fields.indexOf('name');
  const sizeAt = fields.indexOf('self_size');
  const types = heap.snapshot.meta.node_types[typeAt];
  const groups = new Map();
  for (let index = 0; index < heap.nodes.length; index += fields.length) {
    const type = types[heap.nodes[index + typeAt]];
    const name = heap.strings[heap.nodes[index + nameAt]];
    const key = `${type}: ${name}`;
    const summary = groups.get(key) ?? { type, name, count: 0, selfBytes: 0 };
    summary.count++;
    summary.selfBytes += heap.nodes[index + sizeAt];
    groups.set(key, summary);
  }
  const signatures = {};
  const edgeFields = heap.snapshot.meta.edge_fields;
  const edgeTypes = heap.snapshot.meta.edge_types[0];
  const edgeCountAt = fields.indexOf('edge_count');
  let edgeOffset = 0;
  for (let index = 0; index < heap.nodes.length; index += fields.length) {
    const type = types[heap.nodes[index + typeAt]];
    const name = heap.strings[heap.nodes[index + nameAt]];
    const count = heap.nodes[index + edgeCountAt];
    if (type === 'object') {
      const properties = [];
      for (
        let edge = edgeOffset;
        edge < edgeOffset + count * edgeFields.length;
        edge += edgeFields.length
      ) {
        if (edgeTypes[heap.edges[edge]] === 'property')
          properties.push(heap.strings[heap.edges[edge + 1]]);
      }
      const kind =
        properties.includes('attributeBuffer') && properties.includes('batches')
          ? 'Batcher'
          : properties.includes('resources') && properties.includes('_resourceKeysValue')
            ? 'BindGroup'
            : properties.includes('fn') &&
                properties.includes('context') &&
                properties.includes('once')
              ? 'EmitterListener'
              : null;
      if (kind) {
        const key = `${kind} (${name}): ${properties.sort().join(',')}`;
        signatures[key] = (signatures[key] ?? 0) + 1;
      }
    }
    edgeOffset += count * edgeFields.length;
  }
  return { groups, signatures };
}
const firstHeap = await summarize('reports/profiling/menu-before.heapsnapshot.gz');
const lastHeap = await summarize('reports/profiling/menu-after-five.heapsnapshot.gz');
const before = firstHeap.groups;
const after = lastHeap.groups;
const changes = [...new Set([...before.keys(), ...after.keys()])]
  .map((key) => {
    const first = before.get(key) ?? { count: 0, selfBytes: 0 };
    const last = after.get(key) ?? { count: 0, selfBytes: 0 };
    return {
      key,
      beforeCount: first.count,
      afterCount: last.count,
      countDelta: last.count - first.count,
      selfByteDelta: last.selfBytes - first.selfBytes,
    };
  })
  .filter((entry) => entry.countDelta !== 0 || entry.selfByteDelta !== 0)
  .sort((a, b) => b.selfByteDelta - a.selfByteDelta);
await writeFile('reports/profiling/heap-comparison.json', JSON.stringify(changes, null, 2));
const signatureChanges = Object.keys(lastHeap.signatures)
  .filter((key) => lastHeap.signatures[key] !== (firstHeap.signatures[key] ?? 0))
  .map((key) => ({
    signature: key,
    before: firstHeap.signatures[key] ?? 0,
    after: lastHeap.signatures[key],
  }));
await writeFile(
  'reports/profiling/heap-object-signatures.json',
  JSON.stringify(signatureChanges, null, 2),
);
console.log(JSON.stringify(changes.slice(0, 12), null, 2));
console.log(JSON.stringify(signatureChanges, null, 2));
