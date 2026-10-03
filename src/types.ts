export type Invoice = {
  id: number;
  buyer: string;
  sector: string;
  face: number;
  value: number;
  collected: number;
  loss: number;
  due: number;
  status: string;
  evidence: string;
};
export type Transaction = {
  hash: string;
  label: string;
  role: string;
  block: number;
  time: number;
  status: string;
};
export type Snapshot = {
  network: { name: string; chainId: number; block: number; timestamp: number };
  addresses: Record<string, string>;
  actors: Record<string, string>;
  pool: {
    nav: number;
    face: number;
    cash: number;
    shareSupply: number;
    collateralPrice: number;
    impairment: number;
    closed: boolean;
  };
  market: {
    totalSupply: number;
    totalBorrow: number;
    liquidity: number;
    utilization: number;
    borrowAPY: number;
    supplyAPY: number;
    lltv: number;
    collateral: number;
    debt: number;
    ltv: number;
    healthFactor: number | null;
  };
  investor: {
    cash: number;
    shares: number;
    value: number;
    withdrawable: number;
  };
  yield: {
    sy: number;
    pt: number;
    yt: number;
    expiry: number;
    expired: boolean;
    claimable: number;
    exchangeRate: number;
  };
  backstop: { cash: number; collateral: number };
  invoices: Invoice[];
  transactions: Transaction[];
};
