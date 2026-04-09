export interface Division {
  code: string;
}

export interface DivisionDbRecord {
  code: string;
}

export interface CreateDivisionRequest {
  code: string;
}

export interface UpdateDivisionRequest {
  code: string;
  nextCode: string;
}

export interface DeleteDivisionRequest {
  code: string;
}
