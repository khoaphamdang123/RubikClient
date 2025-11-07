import { Component, OnInit } from '@angular/core';
import { HandleService } from '../../../../services/handle.service';
import { IRubik } from '../../../models/item.model';
import { ItemsComponent } from '../../../pages/items/items.component';
import { IOption } from '../../../models/option.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
    
    filter_options:IOption[]=[
      {name:'Core Cubes',checked:false},
      {name:'Novelty Puzzles',checked:false},
      {name:'Multiplayer Games',checked:false},
      {name:'Speed Cubes',checked:false},
      {name:'Bundles',checked:false},
    ]
    
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
     
     toggleCheckBox(option:IOption)
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
       
       // Apply category filters
       const checkedFilters = this.filter_options.filter(opt => opt.checked);
       if(checkedFilters.length > 0)
       {
         filtered = filtered.filter(rubik => {
           return checkedFilters.some(filter => 
             rubik.name.toLowerCase().includes(filter.name.toLowerCase()) ||
             rubik.description.toLowerCase().includes(filter.name.toLowerCase())
           );
         });
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
