export interface SportComplex {
  id: string;
  name: string;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: Date;
}

export interface Court {
  id: string;
  complexId: string;
  sportId: string;
  name: string;
  indoor: boolean;
}
