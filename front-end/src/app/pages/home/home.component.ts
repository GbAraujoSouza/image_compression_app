import { Component } from '@angular/core';
import { HomeService } from '../../services/home.service';
import { JsonPipe } from '@angular/common';

@Component({
  selector: 'home-page',
  templateUrl: './home.component.html',
  // styleUrls: ['./home.component.scss']
  imports: [JsonPipe]
})
export class HomeComponent {

  selectedFile!: File | null;
  
  originalImageUrl: string | null = null;
  compressedImageUrl: string | null = null;

  k: number = 50;

  loading: boolean = false;

  constructor(private readonly homeService: HomeService) {}

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.selectedFile = file;

    // gerar preview local da imagem original
    this.originalImageUrl = URL.createObjectURL(file);

    // resetar imagem comprimida
    this.compressedImageUrl = null;
  }

  compress() {
    if (!this.selectedFile) return;

    this.loading = true;
    this.compressedImageUrl = null;

    this.homeService.compressImage(this.k, this.selectedFile).subscribe({
      next: (blob) => {
        this.compressedImageUrl = URL.createObjectURL(blob);
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
      }
    });
  }
}
