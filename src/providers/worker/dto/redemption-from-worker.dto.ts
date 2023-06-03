export class RedemptionFromWorkerDto {
  transactionId: string;
  redeemId: string;
  redeemer?: string; // create-redeem
  tokenIds?: string[]; // create-redeem
}
