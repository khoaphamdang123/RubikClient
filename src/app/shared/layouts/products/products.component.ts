import { Component, OnInit } from '@angular/core';
import { HandleService } from '../../../../services/handle.service';
import { IRubik } from '../../../models/item.model';
import { ItemsComponent } from '../../../pages/items/items.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import axios from 'axios';
import { environment } from '../../../../environments/environment';

interface CategoryFilterOption {
  _id?: string;
  id?: string;
  category_name: string;
  checked: boolean;
}

interface CategoryResponseItem {
  _id?: string;
  id?: number | string;
  category_name?: string;
  name?: string;
}

interface CategoriesListResponse {
  status: boolean;
  message: string;
  data?: CategoryResponseItem[];
}

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [ItemsComponent, CommonModule, FormsModule],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss'
})
export class ProductsComponent implements OnInit {
     
    rubik_list:IRubik[]=[];
    filteredRubikList:IRubik[]=[];
    displayedRubikList:IRubik[]=[];
    
    // Category filters loaded dynamically from the database
    filter_options: CategoryFilterOption[] = [];
    
    searchQuery:string = '';
    sortOption:string = 'default';
    isLoading:boolean = true;
    isMobileFilterOpen:boolean = false;
    
    sortOptions = [
      { value: 'default', label: 'Default' },
      { value: 'name-asc', label: 'Name (A-Z)' },
      { value: 'name-desc', label: 'Name (Z-A)' }
    ];

     constructor(private handleService:HandleService)
     {
     }
     
     ngOnInit(): void 
     {  
        this.handleService.checkProductToken();
        this.getAllRubik();
     }
     
     toggleCheckBox(option: CategoryFilterOption)
     {
      option.checked=!option.checked;
      this.applyFilters();
     }
     
     clearAllCheckBox()
     {
      this.filter_options.forEach(option=>option.checked=false);
      this.applyFilters();
     }
     
     toggleMobileFilter()
     {
       this.isMobileFilterOpen = !this.isMobileFilterOpen;
     }
     
     onSearchChange()
     {
       this.applyFilters();
     }
     
     onSortChange()
     {
       this.applySorting();
     }
     
     applyFilters()
     {
       // Start with all products
       let filtered = [...this.rubik_list];
       
       // Apply search filter
       if(this.searchQuery.trim())
       {
         const query = this.searchQuery.toLowerCase();
         filtered = filtered.filter(rubik => 
           rubik.name.toLowerCase().includes(query) ||
           rubik.description.toLowerCase().includes(query)
         );
       }
       
       // Apply category filters based on category IDs or, as a fallback,
       // by matching category names in the product metadata.
       const checkedFilters = this.filter_options.filter(opt => opt.checked);
       if (checkedFilters.length > 0) {
         filtered = filtered.filter(rubik =>
           checkedFilters.some(filter => this.productMatchesCategory(rubik, filter))
         );
       }
       
       this.filteredRubikList = filtered;
       this.applySorting();
     }
     
     applySorting()
     {
       let sorted = [...this.filteredRubikList];
       
       switch(this.sortOption)
       {
         case 'name-asc':
           sorted.sort((a, b) => a.name.localeCompare(b.name));
           break;
         case 'name-desc':
           sorted.sort((a, b) => b.name.localeCompare(a.name));
           break;
         default:
           // Keep original order
           break;
       }
       this.displayedRubikList = sorted;       
     }
     
    async getAllRubik()
    {
      try {
        this.isLoading = true;
        this.rubik_list = await this.handleService.getAllRubiks();
        this.filteredRubikList = [...this.rubik_list];
        this.displayedRubikList = [...this.rubik_list];
      } catch(error) {
        console.error('Error loading products:', error);
      } finally {
        this.isLoading = false;         
      }

      // Load categories separately so product rendering isn't blocked
      this.loadCategoriesForFilter().catch(err => {
        console.error('Error loading categories for filters:', err);
      });
    }

     private normalizeCategoryId(value?: string | number | null): string | null {
       if (value === null || value === undefined) {
         return null;
       }
       return value.toString().trim() || null;
     }

     private productMatchesCategory(rubik: IRubik, filter: CategoryFilterOption): boolean {
       const normalizedProductCategoryId = this.normalizeCategoryId(rubik.category_id);
       const normalizedObjectId = this.normalizeCategoryId(filter._id);
       const normalizedNumericId = this.normalizeCategoryId(filter.id);

       if (normalizedProductCategoryId) {
         if (
           (normalizedObjectId && normalizedObjectId === normalizedProductCategoryId) ||
           (normalizedNumericId && normalizedNumericId === normalizedProductCategoryId)
         ) {
           return true;
         }
       }

       const haystack =
         `${rubik.name} ${rubik.description} ${rubik.features ?? ''} ${rubik.feature ?? ''}`.toLowerCase();
       return haystack.includes(filter.category_name.toLowerCase());
     }

     private async loadCategoriesForFilter(): Promise<void> {
       try {
        const token = localStorage.getItem('TOKEN') ?? '';

        const response = await axios.get<CategoriesListResponse>(
          `${environment.server_url}/categories`,
          token
            ? {
                headers: {
                  Authorization: token
                }
              }
            : undefined
        );

        if (response.data?.status && Array.isArray(response.data.data)) {
          this.filter_options = response.data.data
            .filter(c => {
              const hasDisplayName = c.category_name?.trim() ?? 'noo';
              return !!hasDisplayName && (c._id !== 'undefined');
            })
             .map(c => ({
               _id: c._id,
               id: typeof c.id !== 'undefined' ? c.id?.toString() : undefined,
              category_name: (c.category_name ?? c.name ?? '').trim(),
               checked: false
             }));
         } else {
          console.warn('Categories response did not include data array');
           this.filter_options = [];           
         }
       } catch (error) {
         console.error('Error loading categories for product filters:', error);
         this.filter_options = [];
       }
     }
     
    get hasActiveFilters(): boolean {
      return this.filter_options.some(opt => opt.checked) || this.searchQuery.trim() !== '';
    }
    
    get activeFilterCount(): number {
      return this.filter_options.filter(opt => opt.checked).length;            
    }
    
    get resultCount(): number {
      return this.displayedRubikList.length;
    }
}
