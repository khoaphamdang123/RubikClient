import { Component,OnInit } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/layouts/header/header.component';
import { Router,NavigationStart } from '@angular/router';
import { HandleService } from '../services/handle.service';
import { LoadingService } from '../services/loading.service';
import { LoadingComponent } from './pages/loading/loading.component';
@Component({
  selector: 'app-root',
  standalone:true,
  imports: [RouterOutlet,HeaderComponent,LoadingComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  title = 'rbApp';
  showHeader:boolean=true;
  socket!:any;
  ngOnInit(): void 
  { 
  }

  constructor(private router:Router,private loading:LoadingService)
{  
    router.events.forEach((e:any)=>{
      
  if(e instanceof NavigationStart)
  { 
   this.loading.show();
   var token=localStorage.getItem('TOKEN');
    if(e['url'] =="/")
    {  
      if(token!=null && token!="")
      { 
        router.navigate(['/about']);
      }
      else
      {
      router.navigate(['/login']);
      this.showHeader=false;
      }
    }
    if(e['url']=='/login')
    { 
      this.showHeader=false;
      if(token!=null && token!="")
      {  
        router.navigate(['/about']);
      }
    }
    else if(e['url']=='/admin/login' || e['url'].startsWith('/admin/login'))
    {
      this.showHeader=false;
      if(token!=null && token!="")
      {
        try {
          const account = localStorage.getItem('ACCOUNT');
          if(account) {
            const user = JSON.parse(account);
            if(user.role_id === 1 || user.role === 'Admin') {
              router.navigate(['/admin/dashboard']);
            }
          }
        } catch(e) {
          // Invalid account data
        }
      }
    }
    else if(e['url'].startsWith('/admin'))
    {
      // Admin routes - hide header (admin has its own layout)
      this.showHeader=false;
    }
    else{
      if(e['url']=='/')
      { 
      if(token!=null && token!="")
      {
       this.showHeader=true;
      }
      else
      {
        this.showHeader=false;
      }
      }  
      else
      {
      this.showHeader=true;
      }
    }
  }
  else if(e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError)
    {
   this.loading.hide();
    }
    });
  }

}
