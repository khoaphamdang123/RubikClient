import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IRubik } from '../../models/item.model';
import { HandleService } from '../../../services/handle.service';
import { SolveItemsComponent } from '../solve-items/solve-items.component';

@Component({
  selector: 'app-solve',
  standalone: true,
  imports: [CommonModule, SolveItemsComponent],
  templateUrl: './solve.component.html',
  styleUrl: './solve.component.scss',
  providers: [HandleService]
})
export class SolveComponent implements OnInit {
  rubiks: IRubik[] = [];
  isLoading: boolean = true;
     
  constructor(private handleService: HandleService) {}

  ngOnInit(): void {
    this.getSolvableRubik();
  } 

  async getSolvableRubik(): Promise<void> {
    try {
      this.isLoading = true;
      this.rubiks = await this.handleService.getSolvableRubik();
      console.log('Fetched rubiks:', this.rubiks);
    } catch (error) {
      console.error('Error fetching solvable rubiks:', error);
      this.rubiks = [];
    } finally {
      // Add a small delay for smooth loading transition
      setTimeout(() => {
        this.isLoading = false;
      }, 500);
    }
  }
}
