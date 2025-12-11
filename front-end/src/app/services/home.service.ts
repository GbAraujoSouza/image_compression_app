import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ImageInfo {
  width: number;
  height: number;
  k_max: number;
}

@Injectable({
  providedIn: 'root',
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
      responseType: 'blob',
    });
  }

  getMaxK(file: File): Observable<ImageInfo> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ImageInfo>(`${this.API}/max-k`, formData);
  }
  compressImageWithRegion(kRegion: number, kBase: number, file: File, region: any) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('region', JSON.stringify(region));

    return this.http.post(
      `${this.API}/compress-region?k_region=${kRegion}&k_base=${kBase}`,
      formData,
      {
        responseType: 'blob',
      }
    );
  }
  compressImageGlobal(kRegion: number, kBase: number, file: File, region: any) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('region', JSON.stringify(region));

    return this.http.post(
      `${this.API}/compress-region-global?k_region=${kRegion}&k_base=${kBase}`,
      formData,
      {
        responseType: 'blob',
      }
    );
  }

  errorMap(original: File, compressed: Blob) {
    const form = new FormData();
    form.append('file_original', original);
    form.append('file_compressed', compressed);

    return this.http.post(`${this.API}/error-map`, form, { responseType: 'blob' });
  }

  svdStats(file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post(`${this.API}/svd-stats`, form);
  }
}
