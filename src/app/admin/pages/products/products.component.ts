import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { HandleService } from '../../../../services/handle.service';
import { PopupService } from '../../../../services/popup.service';
import { IRubik } from '../../../models/item.model';
import Swal from 'sweetalert2';
import axios from 'axios';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss'
})
export class ProductsComponent implements OnInit {
  products: IRubik[] = [];
  filteredProducts: IRubik[] = [];
  isLoading = false;
  isModalOpen = false;
  isEditMode = false;
  selectedProduct: IRubik | null = null;
  searchTerm = '';

  productForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private handleService: HandleService,
    private popupService: PopupService
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadProducts();
  }

  initForm(): void {
    this.productForm = this.fb.group({
      name: new FormControl('', [Validators.required]),
      description: new FormControl('', [Validators.required]),
      avatar: new FormControl('', [Validators.required]),
      features: new FormControl('')
    });
  }

  async loadProducts(): Promise<void> {
    try {
      this.isLoading = true;
      this.products = await this.handleService.getAllRubiks();
      this.filteredProducts = [...this.products];
    } catch (error) {
      console.error('Error loading products:', error);
      this.popupService.AlertErrorDialog('Failed to load products', 'Error');
    } finally {
      this.isLoading = false;
    }
  }

  onSearch(): void {
    if (!this.searchTerm.trim()) {
      this.filteredProducts = [...this.products];
      return;
    }

    const term = this.searchTerm.toLowerCase();
    this.filteredProducts = this.products.filter(product =>
      product.name?.toLowerCase().includes(term) ||
      product.description?.toLowerCase().includes(term) ||
      product.features?.toLowerCase().includes(term)
    );
  }

  openAddModal(): void {
    this.isEditMode = false;
    this.selectedProduct = null;
    this.productForm.reset();
    this.isModalOpen = true;
  }

  openEditModal(product: IRubik): void {
    this.isEditMode = true;
    this.selectedProduct = product;
    this.productForm.patchValue({
      name: product.name,
      description: product.description,
      avatar: product.avatar,
      features: product.features || ''
    });
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.isEditMode = false;
    this.selectedProduct = null;
    this.productForm.reset();
  }

  async onSubmit(): Promise<void> {
    if (!this.productForm.valid) {
      this.productForm.markAllAsTouched();
      return;
    }

    try {
      const token = localStorage.getItem('TOKEN');
      const formValue = this.productForm.value;

      if (this.isEditMode && this.selectedProduct?.id) {
        // Update product
        await axios.put(
          `${environment.server_url}/admin/products/${this.selectedProduct.id}`,
          formValue,
          { headers: { 'Authorization': token } }
        );
        this.popupService.AlertSuccessDialog('Product updated successfully', 'Success');
      } else {
        // Create product
        await this.handleService.postProduct(formValue);
        this.popupService.AlertSuccessDialog('Product created successfully', 'Success');
      }

      this.closeModal();
      await this.loadProducts();
    } catch (error: any) {
      console.error('Error saving product:', error);
      this.popupService.AlertErrorDialog(
        error.response?.data?.message || 'Failed to save product',
        'Error'
      );
    }
  }

  async deleteProduct(product: IRubik): Promise<void> {
    const result = await Swal.fire({
      title: 'Confirm Delete',
      text: `Are you sure you want to delete product "${product.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    });

    if (!result.isConfirmed) return;

    try {
      const token = localStorage.getItem('TOKEN');
      await axios.delete(
        `${environment.server_url}/admin/products/${product.id}`,
        { headers: { 'Authorization': token } }
      );
      this.popupService.AlertSuccessDialog('Product deleted successfully', 'Success');
      await this.loadProducts();
    } catch (error: any) {
      console.error('Error deleting product:', error);
      this.popupService.AlertErrorDialog(
        error.response?.data?.message || 'Failed to delete product',
        'Error'
      );
    }
  }
}










