import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
    private loadingObject=new BehaviorSubject<boolean>(false);
    public load = this.loadingObject.asObservable();
    constructor() { }
    show()
    { 
      this.loadingObject.next(true);
    }
    hide()
    { 
      this.loadingObject.next(false);                        
    }
  }
