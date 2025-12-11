import { Component } from '@angular/core';
import { HomeService, ImageInfo } from '../../services/home.service';
import { FormsModule } from '@angular/forms';
import { debounceTime, Subject } from 'rxjs';
import { CommonModule } from '@angular/common';

import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';

// Registrar controladores necessários
Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend
);

@Component({
  selector: 'home-page',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  imports: [FormsModule, CommonModule],
})
export class HomeComponent {
  mode: 'tiles' | 'global' = 'global';

  heatmapUrl: string | null = null;
  private singularChart: any;
  private energyChart: any;

  selecting: boolean = false;
  startX = 0;
  startY = 0;

  selectionRect = { x: 0, y: 0, w: 0, h: 0 };
  selectionBox: { x1: number; y1: number; x2: number; y2: number } | null = null;

  selectedFile!: File | null;

  originalImageUrl: string | null = null;
  compressedImageUrl: string | null = null;

  maxK: number = 200;
  kBase: number = 10; // K para a imagem base (baixa resolução)
  kRegion: number = 50; // K para a região selecionada (alta resolução)

  loading: boolean = false;
  showModal: boolean = false;

  // debouncer
  private readonly kChange$ = new Subject<void>();

  constructor(private readonly homeService: HomeService) {
    this.kChange$.pipe(debounceTime(300)).subscribe(() => {
      this.compress();
    });
  }

  destroyCharts() {
    if (this.singularChart) {
      this.singularChart.destroy();
      this.singularChart = null;
    }
    if (this.energyChart) {
      this.energyChart.destroy();
      this.energyChart = null;
    }
  }

  openModal() {
    if (!this.selectedFile || !this.compressedImageUrl) return;

    this.showModal = true;
    this.destroyCharts();

    // Carregar heatmap
    fetch(this.compressedImageUrl)
      .then((res) => res.blob())
      .then((compressedBlob) => {
        this.homeService.errorMap(this.selectedFile!, compressedBlob).subscribe((blob) => {
          this.heatmapUrl = URL.createObjectURL(blob);
        });
      });

    this.homeService.svdStats(this.selectedFile).subscribe((stats: any) => {
      const S = stats.singular_values;
      const cumulativeEnergy = stats.cumulative_energy;

      // Gráfico dos valores singulares
      this.singularChart = new Chart('singularChart', {
        type: 'line',
        data: {
          labels: S.map((_: any, i: any) => i + 1),
          datasets: [
            {
              label: 'Valores Singulares',
              data: S,
              borderColor: '#60a5fa',
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
          },
        },
      });

      // Gráfico da energia acumulada
      this.energyChart = new Chart('energyChart', {
        type: 'line',
        data: {
          labels: cumulativeEnergy.map((_: any, i: any) => i + 1),
          datasets: [
            {
              label: 'Energia Acumulada',
              data: cumulativeEnergy,
              borderColor: '#a855f7',
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
          },
        },
      });
    });
  }
  closeModal() {
    this.showModal = false;
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.selectedFile = file;

    // gerar preview local da imagem original
    this.originalImageUrl = URL.createObjectURL(file);

    // resetar imagem comprimida e seleção
    this.compressedImageUrl = null;
    this.selectionBox = null;
    this.selectionRect = { x: 0, y: 0, w: 0, h: 0 };

    this.homeService.getMaxK(file).subscribe({
      next: (res: ImageInfo) => {
        this.maxK = res.k_max;
        console.log('k_max:', res.k_max);

        // K base: 10-20% do máximo (baixa resolução)
        this.kBase = Math.floor(this.maxK * 0.15);
        // K região: 50-70% do máximo (alta resolução)
        this.kRegion = Math.floor(this.maxK * 0.6);
      },
      error: (err) => console.error(err),
    });
  }

  onKChange() {
    if (!this.selectedFile) return;
    this.kChange$.next();
  }

  compress() {
    if (!this.selectedFile) return;

    this.loading = true;

    const imgEl = document.querySelector('#imgCompressed') as HTMLImageElement;
    const region = this.selectionBox ? this.normalizeSelection(imgEl) : null;

    // -------------------------
    // MODO GLOBAL (SVD único)
    // -------------------------
    if (this.mode === 'global' && region) {
      this.homeService
        .compressImageGlobal(this.kRegion, this.kBase, this.selectedFile, region)
        .subscribe({
          next: (blob) => {
            this.compressedImageUrl = URL.createObjectURL(blob);
            this.loading = false;
          },
          error: (err) => {
            console.error(err);
            this.loading = false;
          },
        });
      return;
    }

    // -------------------------
    // MODO TILES
    // -------------------------
    if (region) {
      this.homeService
        .compressImageWithRegion(this.kRegion, this.kBase, this.selectedFile, region)
        .subscribe({
          next: (blob) => {
            this.compressedImageUrl = URL.createObjectURL(blob);
            this.loading = false;
          },
          error: (err) => {
            console.error(err);
            this.loading = false;
          },
        });
    } else {
      this.homeService.compressImage(this.kBase, this.selectedFile).subscribe({
        next: (blob) => {
          this.compressedImageUrl = URL.createObjectURL(blob);
          this.loading = false;
        },
        error: (err) => {
          console.error(err);
          this.loading = false;
        },
      });
    }
  }

  startSelection(event: MouseEvent) {
    this.selecting = true;

    const img = event.target as HTMLElement;
    const rect = img.getBoundingClientRect();

    this.startX = event.clientX - rect.left;
    this.startY = event.clientY - rect.top;

    this.selectionRect = { x: this.startX, y: this.startY, w: 0, h: 0 };
  }

  updateSelection(event: MouseEvent) {
    if (!this.selecting) return;

    const img = event.target as HTMLElement;
    const rect = img.getBoundingClientRect();

    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;

    this.selectionRect = {
      x: Math.min(this.startX, currentX),
      y: Math.min(this.startY, currentY),
      w: Math.abs(currentX - this.startX),
      h: Math.abs(currentY - this.startY),
    };
  }

  endSelection(event: MouseEvent) {
    this.selecting = false;

    const x1 = this.selectionRect.x;
    const y1 = this.selectionRect.y;
    const x2 = x1 + this.selectionRect.w;
    const y2 = y1 + this.selectionRect.h;

    this.selectionBox = { x1, y1, x2, y2 };

    console.log('Região selecionada:', this.selectionBox);

    // Comprimir automaticamente após selecionar região
    this.compress();
  }

  cancelSelection() {
    this.selecting = false;
  }

  clearSelection() {
    this.selectionBox = null;
    this.selectionRect = { x: 0, y: 0, w: 0, h: 0 };
    this.compress(); // Recomprimir sem região
  }

  normalizeSelection(imgElement: HTMLImageElement) {
    if (!this.selectionBox) return null;

    const width = imgElement.naturalWidth;
    const height = imgElement.naturalHeight;

    return {
      x1: Math.round((this.selectionBox.x1 / imgElement.clientWidth) * width),
      y1: Math.round((this.selectionBox.y1 / imgElement.clientHeight) * height),
      x2: Math.round((this.selectionBox.x2 / imgElement.clientWidth) * width),
      y2: Math.round((this.selectionBox.y2 / imgElement.clientHeight) * height),
    };
  }
}
