import { createContext, useContext } from 'react';

export interface DataServices {
  ready: boolean;
  starting: boolean;
  error: string;
  retry: () => void;
}
export const DataServicesContext = createContext<DataServices>({
  ready: false,
  starting: true,
  error: '',
  retry: () => {},
});
export const useDataServices = () => useContext(DataServicesContext);
