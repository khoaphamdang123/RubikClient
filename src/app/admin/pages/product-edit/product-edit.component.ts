import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import axios from 'axios';
import Swal from 'sweetalert2';
import { environment } from '../../../../environments/environment';
import { PopupService } from '../../../../services/popup.service';
import { IRubik } from '../../../models/item.model';

interface ProductDetailResponse {
  status: boolean;
  message: string;
  data: {
    product: Product;
  };
}

interface UpdateProductResponse {
  status: boolean;
  message: string;
  data?: {
    product?: Product;
  };
}

interface DeleteProductResponse {
  status: boolean;
  message: string;
}

interface Product extends IRubik {
  _id?: number;
  feature?: string;
  category_id?: number;
}

@Component({
  selector: 'app-product-edit',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './product-edit.component.html',
  styleUrl: './product-edit.component.scss'
})
export class ProductEditComponent implements OnInit {
  productForm: FormGroup;
  isLoading = true;
  isSaving = false;
  isDeleting = false;
  loadError: string | null = null;
  productId = '';
  productData?: Product;
  initialFormValue: any;
  serverMessage = '';
  lastSyncedAt: Date | null = null;
  avatarFileName = '';
  avatarUploadError = '';
  isAvatarDropActive = false;
  readonly maxAvatarSizeMb = 3;
  readonly maxAvatarSizeBytes = this.maxAvatarSizeMb * 1024 * 1024;
  private avatarDragDepth = 0;

  readonly fallbackAvatar =
    'https://gw.alipayobjects.com/zos/rmsportal/BiazfanxmamNRoxxVxka.png';

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private popupService: PopupService
  ) {
    this.productForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(1)]],
      description: ['', [Validators.required]],
      avatar: ['', [Validators.required]],
      features: ['']
    });
  }

  ngOnInit(): void {
    this.productId = this.route.snapshot.paramMap.get('id') || '';

    if (!this.productId) {
      this.loadError = 'Missing product identifier. Please return to the product list.';
      this.isLoading = false;
      return;
    }

    this.fetchProduct();
  }

  get avatarPreview(): string {
    const raw = this.productForm.get('avatar')?.value?.trim();
    return raw || this.fallbackAvatar;
  }

  get disableSave(): boolean {
    return this.isSaving || this.productForm.invalid || !this.productForm.dirty;
  }

  get disableReset(): boolean {
    return this.isSaving || !this.productForm.dirty;
  }

  async fetchProduct(): Promise<void> {
    try {
      this.isLoading = true;
      this.loadError = null;
      this.serverMessage = '';
      this.avatarUploadError = '';
      this.avatarFileName = '';
      this.isAvatarDropActive = false;
      this.avatarDragDepth = 0;

      const token = localStorage.getItem('TOKEN');
      const response = await axios.get<ProductDetailResponse>(
        `${environment.server_url}/admin/products/${this.productId}/edit`,
        { headers: { Authorization: token } }
      );

      const product = response.data?.data?.product;

      if (!product) {
        throw new Error(response.data?.message || 'Product not found');
      }
      this.serverMessage = response.data?.message || 'Product detail retrieved.';
      this.lastSyncedAt = new Date();
      this.productData = product;
      this.productForm.patchValue({
        name: product.name || '',
        description: product.description || '',
        avatar: product.avatar || '',
        features: product.feature ?? product.features ?? ''
      });
      this.productForm.markAsPristine();
      this.initialFormValue = this.productForm.getRawValue();
    } catch (error: any) {
      console.error('Error loading product:', error);
      const status = error.response?.status;
      if (status === 401) {
        localStorage.removeItem('TOKEN');
        this.popupService.AlertErrorDialog('Session expired. Please log in again.', 'Unauthorized');
        this.router.navigate(['/admin/login']);
        return;
      }
      if (status === 403) {
        this.loadError =
          error.response?.data?.message ||
          'You do not have permission to edit this product.';
        return;
      }
      if (status === 404) {
        this.loadError = 'Product not found or already removed.';
        return;      
      }
      this.loadError = error.response?.data?.message || error.message || 'Failed to load product details';
    } finally {
      this.isLoading = false;
    }
  }

  async saveChanges(): Promise<void> {
    if (this.productForm.invalid || !this.productId) {
      this.productForm.markAllAsTouched();
      return;
    }

    try {
      this.isSaving = true;
      const token = localStorage.getItem('TOKEN') ?? '';
      const payload = this.buildPayload();

      const response = await axios.post<UpdateProductResponse>(
        `${environment.server_url}/admin/products/${this.productId}`,
        payload,
        { headers: { Authorization: token } }
      );

      if (!response.data?.status) {
        const message = response.data?.message || 'Failed to update product';
        this.popupService.AlertErrorDialog(message, 'Update failed');
        return;
      }

      const successMessage = response.data?.message || 'Product updated successfully';
      const updatedProduct = response.data?.data?.product;

      if (updatedProduct) {
        this.productData = updatedProduct;
        this.productForm.patchValue({
          name: updatedProduct.name || '',
          description: updatedProduct.description || '',
          avatar: updatedProduct.avatar || '',
          features: updatedProduct.feature ?? updatedProduct.features ?? ''
        });
        this.productForm.markAsPristine();
        this.initialFormValue = this.productForm.getRawValue();
        this.lastSyncedAt = new Date();
      } else {
        await this.fetchProduct();
      }

      this.serverMessage = successMessage;
      this.popupService.AlertSuccessDialog(successMessage, 'Success');
    } catch (error: any) {
      console.error('Error updating product:', error);
      if (error.response?.status === 401) {
        this.popupService.AlertErrorDialog('Session expired. Please log in again.', 'Unauthorized');
        localStorage.removeItem('TOKEN');
        this.router.navigate(['/admin/login']);
        return;
      }
      if (error.response?.status === 403) {
        this.popupService.AlertErrorDialog(
          error.response?.data?.message || 'Updating this product is not allowed',
          'Forbidden'
        );
        return;
      }
      this.popupService.AlertErrorDialog(
        error.response?.data?.message || 'Failed to update product',
        'Error'
      );
    } finally {
      this.isSaving = false;
    }
  }

  async deleteProduct(): Promise<void> {
    if (!this.productData?._id && !this.productData?.id || this.isDeleting) {
      return;
    }
    
    const productId = this.productData._id || this.productData.id;
    const productName = this.productData.name || 'this product';
    
    const result = await Swal.fire({
      title: 'Delete product?',
      text: `This will permanently remove ${productName}.`,
      icon: 'warning',
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      showCancelButton: true,
      confirmButtonColor: '#dc2626'
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      this.isDeleting = true;
      const token = localStorage.getItem('TOKEN') ?? '';
      const response = await axios.get<DeleteProductResponse>(
        `${environment.server_url}/admin/products/${productId}/delete`,
        {
          headers: { Authorization: token }
        }
      );

      if (!response.data?.status) {
        const message = response.data?.message || 'Failed to delete product';
        this.popupService.AlertErrorDialog(message, 'Error');
        return;
      }

      const successMessage = response.data?.message || 'Product deleted successfully';
      this.popupService.AlertSuccessDialog(successMessage, 'Deleted');
      this.router.navigate(['/admin/products']);
    } catch (error: any) {
      console.error('Error deleting product:', error);
      if (error.response?.status === 401) {
        this.popupService.AlertErrorDialog('Session expired. Please log in again.', 'Unauthorized');
        localStorage.removeItem('TOKEN');
        this.router.navigate(['/admin/login']);
        return;
      }
      this.popupService.AlertErrorDialog(
        error.response?.data?.message || 'Failed to delete product',
        'Error'
      );
    } finally {
      this.isDeleting = false;
    }
  }

  refresh(): void {
    if (!this.isLoading) {
      this.fetchProduct();
    }
  }

  resetChanges(): void {
    if (!this.initialFormValue) {
      return;
    }
    this.productForm.reset(this.initialFormValue);
    this.productForm.markAsPristine();
    this.avatarFileName = '';
    this.avatarUploadError = '';
    this.isAvatarDropActive = false;
    this.avatarDragDepth = 0;
  }

  goBack(): void {
    this.router.navigate(['/admin/products']);
  }

  controlInvalid(controlName: string): boolean {
    const control = this.productForm.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  onAvatarError(event: Event): void {
    (event.target as HTMLImageElement).src = this.fallbackAvatar;
  }

  onAvatarFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.processAvatarFile(file, () => {
      input.value = '';
    });
  }

  onAvatarDragEnter(event: DragEvent): void {
    event.preventDefault();
    this.isAvatarDropActive = true;
    this.avatarDragDepth += 1;
  }

  onAvatarDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onAvatarDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.avatarDragDepth = Math.max(0, this.avatarDragDepth - 1);
    if (this.avatarDragDepth === 0) {
      this.isAvatarDropActive = false;
    }
  }

  onAvatarDrop(event: DragEvent): void {
    event.preventDefault();
    this.isAvatarDropActive = false;
    this.avatarDragDepth = 0;
    const file = event.dataTransfer?.files?.[0];
    this.processAvatarFile(file);
  }

  clearAvatarSelection(): void {
    const avatarControl = this.productForm.get('avatar');
    const fallback = this.initialFormValue?.avatar ?? '';
    avatarControl?.setValue(fallback);
    avatarControl?.markAsPristine();
    avatarControl?.markAsUntouched();
    this.avatarFileName = '';
    this.avatarUploadError = '';
    this.isAvatarDropActive = false;
    this.avatarDragDepth = 0;
  }

  onAvatarUrlInput(): void {
    this.avatarFileName = '';
    this.avatarUploadError = '';
    this.isAvatarDropActive = false;
    this.avatarDragDepth = 0;
  }

  openAvatarPicker(element: HTMLInputElement): void {
    if (this.isSaving) {
      return;
    }
    element.click();
  }

  private processAvatarFile(file?: File | null, onComplete?: () => void): void {
    if (!file) {
      onComplete?.();
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.avatarUploadError = 'Only image files are supported.';
      onComplete?.();
      return;
    }

    if (file.size > this.maxAvatarSizeBytes) {
      this.avatarUploadError = `Please choose an image under ${this.maxAvatarSizeMb} MB.`;
      onComplete?.();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        this.avatarUploadError = 'Unable to read the selected file.';
        onComplete?.();
        return;
      }
      this.productForm.patchValue({ avatar: result });
      this.productForm.get('avatar')?.markAsDirty();
      this.productForm.markAsDirty();
      this.avatarFileName = file.name;
      this.avatarUploadError = '';
      onComplete?.();
    };
    reader.onerror = () => {
      this.avatarUploadError = 'Something went wrong while reading the file.';
      onComplete?.();
    };
    reader.readAsDataURL(file);
  }

  private buildPayload(): Record<string, unknown> {
    const value = this.productForm.value;
    const payload: Record<string, unknown> = {};

    if (typeof value['name'] !== 'undefined') {
      payload['name'] = value['name']?.trim();
    }
    if (typeof value['description'] !== 'undefined') {
      payload['description'] = value['description']?.trim();
    }
    if (typeof value['avatar'] !== 'undefined') {
      payload['avatar'] = value['avatar'] || null;
    }
    if (typeof value['features'] !== 'undefined') {
      payload['feature'] = value['features']?.trim() || null;
    }

    return payload;
  }
}

