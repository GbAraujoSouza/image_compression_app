import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class HomeService {

  private readonly API = 'http://localhost:8000/api';

  constructor(private readonly http: HttpClient) {}

  uploadImage(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.API}/upload-image`, formData);
  }

  compressImage(k: number, file: File): Observable<Blob> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post(`${this.API}/compress?k=${k}`, formData, {
      responseType: 'blob'
    });
  }
}
