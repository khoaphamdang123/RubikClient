import { Component, Input } from '@angular/core';
import { IRubik } from '../../models/item.model';
import { environment } from '../../../environments/environment';
import { toSlug } from '../../utils/slug.utils';

@Component({
  selector: 'app-items',
  standalone: true,
  imports: [],
  templateUrl: './items.component.html',
  styleUrl: './items.component.scss'
})
export class ItemsComponent{
  @Input() rubik!:IRubik; 

  public environment=`${environment.client_url}`;

  getProductSlug(): string {
    return toSlug(this.rubik.name);
  }
}
