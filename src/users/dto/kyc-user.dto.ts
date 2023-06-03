// export enum eventKyc {
//     CREATED = 'user.created',
//     READYTOREVIEW = 'user.readyToReview',
//     INREVIEW = 'user.inReview',
//     APPROVED = 'review.approved',
//   }
export class ObjBase {
  type: string;
  value: string;
}

export enum StatusKyc {
  WAITING = 'waiting',
  READYTOREVIEW = 'readyToReview',
  INREVIEW = 'inReview',
  REJECTED = 'rejected',
  APPROVED = 'approved',
}
export class EventBase {
  guid: string;
  status: StatusKyc;
  clientId: string;
  event: string;
  recordId: string;
  refId: string;
}

export class Identity {
  address: ObjBase;
  dob: ObjBase;
  email: ObjBase;
  family_name: ObjBase;
  given_name: ObjBase;
  phone: ObjBase;
  national_id_number: ObjBase;
  driving_license_number: ObjBase;
  passport_id_number: ObjBase;
  national_id_issuing_country: ObjBase;
  driving_license_issuing_country: ObjBase;
  passport_issuing_country: ObjBase;
  passport_number: ObjBase;
  proof_of_address: ObjBase;
  national_id: ObjBase;
  driving_license: ObjBase;
  passport: ObjBase;
  selfie: ObjBase;
}

export class EventKYC extends EventBase {
  blockPassID: string;
  inreviewDate: Date;
  waitingDate: Date;
  approvedDate: Date;
  recordId: string;
  refId: string;
}

export class SingleCandidateDto extends EventKYC {
  status: StatusKyc;
  identities: Identity;
}
