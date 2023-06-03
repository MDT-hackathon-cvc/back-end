export interface PagingDocument {
  docs?: any[];
  totalDocs?: number;
  limit?: number;
  page?: number;
  pagingCounter?: number;
  hasPrevPage?: boolean;
  hasNextPage?: boolean;
  prevPage?: string;
  nextPage?: string;
  [key: string]: any;
}
