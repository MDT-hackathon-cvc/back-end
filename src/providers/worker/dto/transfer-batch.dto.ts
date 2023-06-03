export class TransferBatchDto {
  hash: string;
  operator: string;
  from: string;
  to: string;
  ids: number[];
  values: number[];
}
