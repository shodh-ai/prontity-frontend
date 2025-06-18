export interface RegisterRequestPayload {
  email: string;
  password: string;
}

export interface RegisterResponsePayload {
  data: string;
  message: string;
}
