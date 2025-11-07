import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HandleService } from '../../../services/handle.service';
import { IRubik } from '../../models/item.model';
import { toSlug, fromSlug } from '../../utils/slug.utils';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.scss',
  providers: [HandleService]
})
export class ProductDetailComponent implements OnInit {
  rubik!: IRubik;
  description: string = "Touch, reveal, and solve with the Rubik's Phantom. Innovation adds a new layer of challenge to the original 3x3 Cube. Touch the Cube tiles to temporarily reveal color. Solve the latest Cube, the Rubik's Phantom, as the colors fade. You will be amazed by the thermochromic technology of this Cube. Reveal the Phantom's colors with the heat of your touch. Solve the cube before it fades back to black! This smart Cube is unlike any toy you have ever played with before. The Rubik's Phantom is a difficult challenge level, meant for experienced Cubers. This brain teaser puzzle Cube is one of the most challenging to solve of the Rubik's collection. Puzzle-loving adults and kids ages 8 and up will love this anxiety relief puzzle speed Cube. Invented in 1974 by Ernő Rubik, the original color-matching puzzle toy- the Rubik's Cube- was created to help students understand three-dimensional problems. The prototype Magic Cube did things that the world had not seen before. It turned, it twisted and yet it did not break. Adding 54 colorful stickers to the six sides gave the puzzle its iconic look. Over 40 years of history has led the Rubik's Cube to become one of the best-selling toys ever. With the new Rubik's Phantom- you can become the puzzle Cube master of your house with thermochromic technology. Show your peers that you can accomplish something new with this toy! This smart speed Cube 3x3 makes the perfect gift idea for people of all ages or a stocking stuffer for anyone who loves a challenge. Share your Rubik's Phantom solving skills with us on our social channels using #RubiksCube";
  showFullDescription: boolean = false;
  selectedImage: string = '';
  detailImages: string[] = [];
  isLoading: boolean = true;
  currentImageIndex: number = 0;
  isZoomed: boolean = false;
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private handleService: HandleService
  ) {}

  ngOnInit(): void {
    this.getRubikInfo();
  }

  async getRubikInfo() {
    try {
      this.isLoading = true;
      const slug = this.route.snapshot.paramMap.get('slug');
      
      if (!slug) {
        this.router.navigate(['/products']);
        return;
      }

      // Convert slug back to product name for API call
      const productName = fromSlug(slug);
      this.rubik = await this.handleService.getRubikById(productName);
      
      if (this.rubik) {
        this.description = this.rubik.description || this.description;
        this.selectedImage = this.rubik.avatar;
        this.detailImages = [
          this.rubik.avatar,
          'assets/images/full1 (2).jpg',
          'assets/images/full1 (4).jpg',
          'assets/images/full1 (5).jpg'
        ];
      }
    } catch (error) {
      console.error('Error loading product:', error);
      this.router.navigate(['/products']);
    } finally {
      this.isLoading = false;
    }
  }

  toggleDescription(): void {
    this.showFullDescription = !this.showFullDescription;
  }

  getDescription(): string {
    if (!this.description) return '';
    
    if (this.showFullDescription) {
      return this.description;
    } else {
      const words = this.description.split(' ').slice(0, 50);
      return words.length < 50 ? this.description : `${words.join(' ')}...`;
    }
  }

  selectImage(image: string, index: number): void {
    this.selectedImage = image;
    this.currentImageIndex = index;
  }

  previousImage(): void {
    if (this.currentImageIndex > 0) {
      this.currentImageIndex--;
      this.selectedImage = this.detailImages[this.currentImageIndex];
    }
  }

  nextImage(): void {
    if (this.currentImageIndex < this.detailImages.length - 1) {
      this.currentImageIndex++;
      this.selectedImage = this.detailImages[this.currentImageIndex];
    }
  }

  get canGoPrevious(): boolean {
    return this.currentImageIndex > 0;
  }

  get canGoNext(): boolean {
    return this.currentImageIndex < this.detailImages.length - 1;
  }

  getProductSlug(): string {
    return this.rubik ? toSlug(this.rubik.name) : '';
  }

  openZoom(): void {
    this.isZoomed = true;
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  }

  closeZoom(): void {
    this.isZoomed = false;
    document.body.style.overflow = ''; // Restore scrolling
  }

  previousImageZoom(): void {
    if (this.currentImageIndex > 0) {
      this.currentImageIndex--;
      this.selectedImage = this.detailImages[this.currentImageIndex];
    }
  }

  nextImageZoom(): void {
    if (this.currentImageIndex < this.detailImages.length - 1) {
      this.currentImageIndex++;
      this.selectedImage = this.detailImages[this.currentImageIndex];
    }
  }
}
