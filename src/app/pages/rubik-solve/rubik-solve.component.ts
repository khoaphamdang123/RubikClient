import { Component,ElementRef,HostListener, OnInit, OnDestroy,ViewChild} from '@angular/core';
import { ColorPaletteComponent } from '../../shared/layouts/color-palette/color-palette.component';
import { PopupService } from '../../../services/popup.service';
import { HandleService } from '../../../services/handle.service';
import { SesService } from '../../../services/ses.service';
import { ActivatedRoute, mapToCanActivateChild } from '@angular/router';
import { NotFoundComponent } from '../not-found/not-found.component';
import * as _ from 'lodash';
import { Subscription, combineAll, concat } from 'rxjs';
import { ImageDetectComponent } from '../image-detect/image-detect.component';
@Component({
  selector: 'app-rubik-solve',
  standalone: true,
  imports: [ColorPaletteComponent,ImageDetectComponent,NotFoundComponent],
  templateUrl: './rubik-solve.component.html',
  styleUrl: './rubik-solve.component.scss',
  providers:[PopupService,HandleService]
})
export class RubikSolveComponent implements OnInit, OnDestroy {
  isShowThreeD:boolean=true;
  rubikName:string='';
  threeDColor:string = '#3d81f6';
  flatColor:string = 'transparent';
  startPosX!:number;
  startPostY!:number;
  isRotating:boolean=false;
  startRotateX:number=0;
  startRotateY:number=0;
  cubeRotateStyle:string='';
  rotationX:number=0;
  rotationY:number=0;
  curr_horizontal_idx:number=0;
  
  // Smooth rotation properties
  velocityX:number=0;
  velocityY:number=0;
  lastTimestamp:number=0;
  animationFrameId:number|null=null;
  isDragging:boolean=false;
  isButtonRotating:boolean=false;
  isTransitioning:boolean=false;
  transitioningToFlat:boolean=false;
  transitioningToCube:boolean=false;
  color_face:string[]=['green','red','blue','orange'];
  is_upside_down:boolean=false;
  curr_left_img:string='assets/images/curved-left-arrow.png';
  curr_right_img:string='assets/images/next.png';
  curr_up_down_img:string ='assets/images/down-arrow.png';
  btn_color:string='';
  rubik_block_color:string[]=[];
  rubik_2x2_block_color:string[]=[];
  color_disable:string[]=[];
  rubik_temp_arr!:string[];
  upside_down_horizontal_rote:number=0;
  horizontal_rotate:number=-48;
  list_device:any[]=[];
  is_camera_click:boolean=false;
  selected_images:any=[];
  img_file:File[]=[];
  nums_of_face:string[]=['Up face','Right face','Front face','Down face','Left face','Back face'];
  username:string='';
  delay=(ms:number)=>new Promise(rs=>setTimeout(rs,ms));

   
  @ViewChild('video_player',{static:true}) video_player!:ElementRef;
  @ViewChild('log_area',{static:true}) log_area!:ElementRef;
  @ViewChild('flatContainer3x3') flatContainer3x3?:ElementRef<HTMLElement>;
  @ViewChild('flatCube3x3') flatCube3x3?:ElementRef<HTMLElement>;
  @ViewChild('flatContainer2x2') flatContainer2x2?:ElementRef<HTMLElement>;
  @ViewChild('flatCube2x2') flatCube2x2?:ElementRef<HTMLElement>;
   eventSubsribe!:Subscription;
  private flatResizeObserver?: ResizeObserver;
  constructor(private popupService:PopupService,private handleService:HandleService,private sseService:SesService,private route:ActivatedRoute)
  {    
  }
 

  cameraClick()
  {
    this.is_camera_click=!this.is_camera_click;
    if(this.is_camera_click)
    {
       this.handleService.loadVideo(this.video_player);
    }
  }

  ngOnInit(): void 
  {
  this.getRubikName();
  this.checkTokenValid();
   this.getListDevice();
   this.initRubikBlock();
   this.rubik_temp_arr=Array(54).fill('');
   this.initColorDisable();
   var user=JSON.parse(localStorage.getItem("ACCOUNT") as string);
   this.username=user.username;
  //  const text=this.log_area.nativeElement.value;
  //  this.log_area.nativeElement.value=text+'hello'+'\n';
  //  this.log_area.nativeElement.value=text+'fuck'+'\n';

   this.sseService.initEventSource(this.username).subscribe((data)=>
   {
  
    var val=data.data.split(':');
    var username_values=val[0].split('_');
    var username_value=username_values[0];
    
    var command=username_values[1]+':'+val[1];
   
   if(username_value==this.username)
    { 
     const text=this.log_area.nativeElement.value;
     this.log_area.nativeElement.value=text+command+'\n';
    }
   },error=>{
   });
  //  this.handleService.readStreamKafka().subscribe(data=>{
  //   alert(data);
  // },err=>{
  //   alert("Error:"+err);
  // });
  }
 
 
 getRubikName()
 {
   this.rubikName=this.route.snapshot.paramMap.get('name') as string;
 }
 
 async checkTokenValid()
 {
  await this.handleService.getDetailSolveRubikPage(this.rubikName);
 }

initColorDisable()
{
  for(let i=0;i<6;i++)
  {
    this.color_disable[i]='false';
  }
}

checkFrequencyColor(color:string)
{   
  var is_disable=this.countAllFrequency(color);
  
  let idx=this.getIndexColor(color);

  if(idx !== -1)
  {
    if(is_disable)
    {
      this.color_disable[idx]='true';
    }
    else
    {
      this.color_disable[idx]='false';
    }
  }
}

getIndexColor(color:string)
{ 
  let idx=-1;
  switch(color)
  {
    case 'whitesmoke':idx=0;break;
    case 'orange':idx=1;break;
    case 'green':idx=2;break;
    case 'red':idx=3;break;
    case 'blue':idx=4;break;
    case 'yellow':idx=5;break;
  }
  return idx;
}

convertColorToNotation(color:string)
{ 
switch(color)
{
  case 'whitesmoke':return 'U';
  case 'yellow':return 'D';
  case 'red':return 'R';
  case 'orange':return 'L';
  case 'green':return 'F';
  case 'blue':return 'B';
}
return '';
}





countAllFrequency(color:string):boolean
{ 
  if(this.rubikName=="Rubik's 3x3")
  {
    let num_freq=this.rubik_block_color.filter(c=>c==color).length;
    if(num_freq>=9)
    {
      return true;
    }
  }
  else if(this.rubikName=="Rubik's Apprentice 2x2")
  {
    let num_freq=this.rubik_2x2_block_color.filter(c=>c==color).length;
    
    if(num_freq>=4)
    {
      return true;
    }
  }
  return false;
}

// Count how many times a color appears in the cube (for validation)
countColorOccurrences(color:string):number
{
  if(this.rubikName=="Rubik's 3x3")
  {
    return this.rubik_block_color.filter(c=>c==color).length;
  }
  else if(this.rubikName=="Rubik's Apprentice 2x2")
  {
    return this.rubik_2x2_block_color.filter(c=>c==color).length;
  }
  return 0;
}

showValue()
{
  alert("clickable");
}
switchThreeD()
{
  if(this.isTransitioning) return;
  
  this.isTransitioning = true;
  this.transitioningToCube = true;
  this.transitioningToFlat = false;
  
  // Wait a bit to ensure the flat view is rendered, then start transition
  setTimeout(() => {
    this.isShowThreeD = true;
    this.threeDColor = '#3d81f6';
    this.flatColor = 'transparent';
    
    // Remove transition class after animation completes
    setTimeout(() => {
      this.transitioningToCube = false;
      this.isTransitioning = false;
    }, 1200); // Match CSS transition duration
  }, 50);
}
switchFlatView()
{
  if(this.isTransitioning) return;
  
  this.isTransitioning = true;
  this.transitioningToFlat = true;
  this.transitioningToCube = false;
  
  // Start transition, then switch view
  this.isShowThreeD = false;
  this.threeDColor = 'transparent';
  this.flatColor = '#3d81f6';
  
  // Fit flat cube into container during transition to avoid clipping (apply immediately and next frame)
  this.applyFlatScaleFit();
  requestAnimationFrame(() => this.applyFlatScaleFit());
  // Continuously adapt scale during the transition window
  this.runFlatScaleLoop(1200);
  // Keep auto-fit active while in flat mode
  this.startFlatAutoFit();
  
  // Remove transition class after animation completes
  setTimeout(() => {
    this.transitioningToFlat = false;
    this.isTransitioning = false;
  }, 1200); // Match CSS transition duration
}

startRotate(event:MouseEvent)
{ 
  this.isRotating=true;
  this.isDragging=true;
  this.isButtonRotating=false; // Disable CSS transition during drag
  this.startPosX=event.clientX;
  this.startPostY=event.clientY;
  this.lastTimestamp=Date.now();
  
  // Stop any ongoing momentum animation
  if(this.animationFrameId){
    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId=null;
  }
  
  // Reset velocity
  this.velocityX=0;
  this.velocityY=0;
}

stopRotate()
{ 
  this.isRotating=false;
  this.isDragging=false;  
  
  // Start momentum animation if there's velocity
  if(Math.abs(this.velocityX)>0.5 || Math.abs(this.velocityY)>0.5){
    this.applyMomentum();
  }
}


@HostListener('document:mousemove',['$event'])
rotateCube(event:MouseEvent)
{
  if(this.isRotating)
  { 
    const currentTime=Date.now();
    const timeDelta=currentTime-this.lastTimestamp;
    
    // Calculate delta positions
    const deltaX=event.clientX-this.startPosX;
    const deltaY=event.clientY-this.startPostY;
    
    // Calculate velocity (degrees per millisecond)
    if(timeDelta>0){
      this.velocityX=(-deltaY*0.5)/timeDelta*16; // Normalize to 60fps (negated for natural movement)
      this.velocityY=(deltaX*0.5)/timeDelta*16;
    }
    
    // Apply rotation with smoother sensitivity (negate deltaY for natural drag behavior)
    this.rotationX+=-deltaY*0.5;
    this.rotationY+=deltaX*0.5;
    
    // Update positions
    this.startPosX=event.clientX;
    this.startPostY=event.clientY;
    this.lastTimestamp=currentTime;    
    // Update cube style without transition for smooth dragging
    this.updateCubeTransform();
  }
}

// Apply momentum after drag ends
applyMomentum(){
  const friction=0.95; // Friction coefficient
  
  const animate=()=>{
    // Apply velocity to rotation
    this.rotationX+=this.velocityX;
    this.rotationY+=this.velocityY;
    
    // Apply friction
    this.velocityX*=friction;
    this.velocityY*=friction;
    
    // Update transform
    this.updateCubeTransform();
    
    // Continue animation if velocity is significant
    if(Math.abs(this.velocityX)>0.1 || Math.abs(this.velocityY)>0.1){
      this.animationFrameId=requestAnimationFrame(animate);
    }else{
      this.velocityX=0;
      this.velocityY=0;
      this.animationFrameId=null;
    }
  };
  
  this.animationFrameId=requestAnimationFrame(animate);
}

// Update cube transform
updateCubeTransform(){
  this.cubeRotateStyle=`rotateX(${this.rotationX}deg) rotateY(${this.rotationY}deg)`;
}

// Touch event handlers for mobile
@HostListener('touchstart',['$event'])
handleTouchStart(event:TouchEvent){
  if(event.target && (event.target as HTMLElement).closest('.rubik-view')){
    event.preventDefault();
    const touch=event.touches[0];
    this.isRotating=true;
    this.isDragging=true;
    this.startPosX=touch.clientX;
    this.startPostY=touch.clientY;
    this.lastTimestamp=Date.now();
    
    if(this.animationFrameId){
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId=null;
    }
    
    this.velocityX=0;
    this.velocityY=0;
  }
}

@HostListener('touchmove',['$event'])
handleTouchMove(event:TouchEvent){
  if(this.isRotating && event.touches.length===1){
    event.preventDefault();
    const touch=event.touches[0];
    const currentTime=Date.now();
    const timeDelta=currentTime-this.lastTimestamp;
    
    const deltaX=touch.clientX-this.startPosX;
    const deltaY=touch.clientY-this.startPostY;
    
    if(timeDelta>0){
      this.velocityX=(-deltaY*0.5)/timeDelta*16; // Negated for natural movement
      this.velocityY=(deltaX*0.5)/timeDelta*16;
    }
    
    this.rotationX+=-deltaY*0.5; // Negate deltaY for natural drag behavior
    this.rotationY+=deltaX*0.5;
    
    this.startPosX=touch.clientX;
    this.startPostY=touch.clientY;
    this.lastTimestamp=currentTime;
    
    this.updateCubeTransform();
  }
}

@HostListener('touchend',['$event'])
handleTouchEnd(event:TouchEvent){
  if(this.isRotating){
    event.preventDefault();
    this.isRotating=false;
    this.isDragging=false;
    
    if(Math.abs(this.velocityX)>0.5 || Math.abs(this.velocityY)>0.5){
      this.applyMomentum();
    }
  }
}

rotateRightButton()
{
  // Enable CSS transition for smooth button rotation
  this.isButtonRotating=true;
  
  this.curr_horizontal_idx-=1;
  if(this.curr_horizontal_idx<0)
  {
    this.curr_horizontal_idx=3;
  }
 if(!this.is_upside_down)
 {
  switch(this.curr_horizontal_idx)
{  
  case 0:this.cubeRotateStyle=`rotateX(-32deg) rotateY(-48deg)`;break;
  case 1: this.cubeRotateStyle=`rotateX(-32deg) rotateY(225deg)`;break;
  case 2: this.cubeRotateStyle=`rotateX(-32deg) rotateY(130deg)`;break;
  case 3: this.cubeRotateStyle=`rotateX(-32deg) rotateY(45deg)`;break;
}
 }
 else
 {
  this.upside_down_horizontal_rote-=90;
  switch(this.curr_horizontal_idx)
{ 
  case 0:this.cubeRotateStyle=`rotateX(148deg) rotateY(${this.upside_down_horizontal_rote}deg)`;break;
  case 1:this.cubeRotateStyle=`rotateX(148deg) rotateY(${this.upside_down_horizontal_rote}deg)`;break;
  case 2:this.cubeRotateStyle=`rotateX(148deg) rotateY(${this.upside_down_horizontal_rote}deg)`;break;
  case 3:this.cubeRotateStyle=`rotateX(148deg) rotateY(${this.upside_down_horizontal_rote}deg)`;break;
}
if(this.curr_horizontal_idx==0)
{
  this.upside_down_horizontal_rote=230;
}
 }
}

rotateLeftButton()
{
// Enable CSS transition for smooth button rotation
this.isButtonRotating=true;

this.curr_horizontal_idx+=1;
if(this.curr_horizontal_idx>3)
{
  this.curr_horizontal_idx=0;
}
if(!this.is_upside_down)
{
 this.horizontal_rotate+=100;
switch(this.curr_horizontal_idx)
{
  case 0:this.cubeRotateStyle=`rotateX(-32deg) rotateY(-48deg)`;break;
  case 1: this.cubeRotateStyle=`rotateX(-32deg) rotateY(225deg)`;break;
  case 2: this.cubeRotateStyle=`rotateX(-32deg) rotateY(130deg)`;break;
  case 3: this.cubeRotateStyle=`rotateX(-32deg) rotateY(45deg)`;break;
}
}
else
{this.upside_down_horizontal_rote+=90;
  switch(this.curr_horizontal_idx)
{ 
  case 0:this.cubeRotateStyle=`rotateX(148deg) rotateY(${this.upside_down_horizontal_rote}deg)`;break;
  case 1:this.cubeRotateStyle=`rotateX(148deg) rotateY(${this.upside_down_horizontal_rote}deg)`;break;
  case 2:this.cubeRotateStyle=`rotateX(148deg) rotateY(${this.upside_down_horizontal_rote}deg)`;break;
  case 3:this.cubeRotateStyle=`rotateX(148deg) rotateY(${this.upside_down_horizontal_rote}deg)`;break;
}
if(this.curr_horizontal_idx==0)
{
  this.upside_down_horizontal_rote=230;
}
}
}

rotateUpsideDown()
{  
  // Enable CSS transition for smooth button rotation
  this.isButtonRotating=true;
  
  this.is_upside_down=!this.is_upside_down
 if(this.is_upside_down)
 {
  switch(this.curr_horizontal_idx)
  {
   case 0:this.cubeRotateStyle=`rotateX(148deg) rotateY(230deg)`;this.upside_down_horizontal_rote=230;break;
   case 1:this.cubeRotateStyle=`rotateX(148deg) rotateY(680deg)`;this.upside_down_horizontal_rote=680;break;
   case 2:this.cubeRotateStyle=`rotateX(148deg) rotateY(410deg)`;this.upside_down_horizontal_rote=410;break;
   case 3:this.cubeRotateStyle=`rotateX(148deg) rotateY(140deg)`;this.upside_down_horizontal_rote=230;break;
  }
}
else{
  switch(this.curr_horizontal_idx)
  {
   case 0:this.cubeRotateStyle=`rotateX(-32deg) rotateY(-48deg)`;break;
   case 1:this.cubeRotateStyle=`rotateX(-32deg) rotateY(225deg)`;break;
   case 2:this.cubeRotateStyle=`rotateX(-32deg) rotateY(130deg)`;break;
   case 3: this.cubeRotateStyle=`rotateX(-32deg) rotateY(45deg)`;break;
  }
}
}


changeImage(image:string,direction:string)
{
  switch(direction)
  {
    case 'left':this.curr_left_img=image;break;
    case 'right':this.curr_right_img=image;break;
    case 'up-down':this.curr_up_down_img=image;break;
  }
}

getListDevice()
{
  var user=JSON.parse(localStorage.getItem('ACCOUNT')||'{}');
  var username=user.username;
this.handleService.getDeviceList(username).then((list)=>{
  this.list_device=list;
});
}

changeBtnColor(event:string)
{
  this.btn_color=event;
}

changeBlockColor(event:MouseEvent)
{
 const btn=event.currentTarget as HTMLButtonElement;
 const id =btn.dataset['field'] as string;
 var num_id=parseInt(id);
 
 // Get current and new color info
 let current_color:string;
 let max_allowed:number;
 
 if(this.rubikName=="Rubik's 3x3")
 {
   current_color = this.rubik_block_color[num_id-1];
   max_allowed = 9; // 9 blocks per face on 3x3
 }
 else if(this.rubikName=="Rubik's Apprentice 2x2")
 {
   current_color = this.rubik_2x2_block_color[num_id-1];
   max_allowed = 4; // 4 blocks per face on 2x2
 }
 else
 {
   return;
 }
 
 // If trying to apply the same color, just ignore
 if(current_color === this.btn_color)
 {
   return;
 }
 
 // Check if the new color would exceed the limit
 const newColorCount = this.countColorOccurrences(this.btn_color);
 
 if(newColorCount >= max_allowed)
 {
   const colorName = this.btn_color.charAt(0).toUpperCase() + this.btn_color.slice(1);
   this.popupService.AlertErrorDialog(
     `Each color can only appear ${max_allowed} times (one complete face). You already have ${newColorCount} blocks with ${colorName}.`,
     'Color Limit Exceeded'
   );
   return;
 }
 
 // Apply the new color
 if(this.rubikName=="Rubik's 3x3")
 {
   this.rubik_block_color[num_id-1]=this.btn_color;
 }
 else if(this.rubikName=="Rubik's Apprentice 2x2")
 {
   this.rubik_2x2_block_color[num_id-1]=this.btn_color;
 }
 
 // Update color availability status
 this.checkFrequencyColor(this.btn_color);
 
 // Also check the previous color to see if it should be re-enabled
 if(current_color && current_color !== 'grey' && current_color !== '')
 {
   this.checkFrequencyColor(current_color);
 }
}

blankRubikBlock()
{  
  // var colors:string[]=['whitesmoke','orange','green','red','blue','yellow'];
  // for(let i=0;i<colors.length;i++)
  // {
  //   var count_color=this.rubik_block_color.filter(b=>b==colors[i]).length;
  //   alert(`Number of block of color ${colors[i]} is:${count_color}`);
  // }
 if(this.rubikName==="Rubik's 3x3".trim())
 {
  for(let i=0;i<54;i++)
  {
    this.rubik_block_color[i]='grey';
  }
}
else if(this.rubikName==="Rubik’s Apprentice 2x2")
{
  for(let i=0;i<24;i++)
  {
  this.rubik_2x2_block_color[i]='grey';
  }
}
}
  initRubikBlock()
  {
   if(this.rubikName=="Rubik's 3x3")
   {
    for(let i=0;i<54;i++)
    { 
      if(i>=0 && i<9)
      {
      this.rubik_block_color.push('whitesmoke');
      }
      else if(i>=9 && i<18)
      {
        this.rubik_block_color.push('orange');
      }
      else if(i>=18 && i<27)
      {
        this.rubik_block_color.push('green');
      }
      else if(i>=27 && i<36)
      {
        this.rubik_block_color.push('red');
      }
      else if(i>=36 && i<45)
      {
        this.rubik_block_color.push('blue');
      }
      else
      {
        this.rubik_block_color.push('yellow');
      }
    }
  }
  else if(this.rubikName=="Rubik’s Apprentice 2x2")
  {
    for(let i=0;i<24;i++)
    {
      if(i>=0 && i<4)
      {
       this.rubik_2x2_block_color.push('whitesmoke');
      }
      else if(i>=4 && i<8)
      {
        this.rubik_2x2_block_color.push('orange');
      }
      else if(i>=8 && i<12)
      {
        this.rubik_2x2_block_color.push('green');
      }
      else if(i>=12 && i<16)
      {
        this.rubik_2x2_block_color.push('red');
      }
      else if(i>=16 && i<20)
      {
        this.rubik_2x2_block_color.push('blue');
      }
      else{
        this.rubik_2x2_block_color.push('yellow');
      }
    }
  }
  }
   
  centerBlockColor(rubik_array:string[])
  {
    rubik_array[4]='whitesmoke';
    rubik_array[13]='orange';
    rubik_array[22]='green';
    rubik_array[31]='red';
    rubik_array[40]='blue';
    rubik_array[49]='yellow';
  }

  resetRubikBlock()
  {
    if(this.rubikName=="Rubik's 3x3")
    { 
    for(let i=0;i<54;i++)
    { 
      if(i>=0 && i<9)
      {
      this.rubik_block_color[i]='whitesmoke';
      }
      else if(i>=9 && i<18)
      {
        this.rubik_block_color[i]='orange';
      }
      else if(i>=18 && i<27)
      {
        this.rubik_block_color[i]='green';
      }
      else if(i>=27 && i<36)
      {
        this.rubik_block_color[i]='red';
      }
      else if(i>=36 && i<45)
      {
        this.rubik_block_color[i]='blue';
      }
      else
      {
        this.rubik_block_color[i]='yellow';
      }
    }
  }
  else if(this.rubikName=="Rubik’s Apprentice 2x2")
  {
    for(let i=0;i<24;i++)
    { 
      if(i>=0 && i<4)
      {
      this.rubik_2x2_block_color[i]='whitesmoke';
      }
      else if(i>=4 && i<8)
      {
        this.rubik_2x2_block_color[i]='orange';
      }
      else if(i>=8 && i<12)
      {
        this.rubik_2x2_block_color[i]='green';
      }
      else if(i>=12 && i<16)
      {
        this.rubik_2x2_block_color[i]='red';
      }
      else if(i>=16 && i<20)
      {
        this.rubik_2x2_block_color[i]='blue';
      }
      else
      {
        this.rubik_2x2_block_color[i]='yellow';
      }
    }
  }

  }
  

 assignRandomColor(rubik_array:string[])
 {
 if(this.rubikName=="Rubik's 3x3")
 {
  var colors_obj:{[key:string]:number}={
    'whitesmoke':8,
    'orange':8,
    'green':8,
    'red':8,
    'blue':8,
    'yellow':8
  };
  const skip_idx:number[]=[4,13,22,31,40,49];
  this.centerBlockColor(rubik_array);
  for(let i=0;i<54;i++)
  { 
    if(skip_idx.includes(i))
    {
      continue;
    }
    var ob=Object.keys(colors_obj);
    var ob_len:number=ob.length;
    var random_idx:number=Math.round(Math.random()*(ob_len-1));
    rubik_array[i]=ob[random_idx];
    colors_obj[ob[random_idx]]-=1;
    if(colors_obj[ob[random_idx]]==0)
    {
      colors_obj=Object.keys(colors_obj).filter(key=>
        key!=ob[random_idx]).reduce((newObject,key)=>{
          newObject[key]=colors_obj[key];
          return newObject;
        },{});
    }
  }
}
else if(this.rubikName=="Rubik’s Apprentice 2x2")
{
  var color_obj:{[key:string]:number}=
  {
   'whitesmoke':4,
   'orange':4,
   'green':4,
   'red':4,
   'blue':4,
   'yellow':4
  };
  for(let i=0;i<24;i++)
  {
    var ob=Object.keys(color_obj);
    var ob_len=ob.length;
    var random_idx=Math.round(Math.random()*(ob_len-1));
    this.rubik_2x2_block_color[i]=ob[random_idx];
    color_obj[ob[random_idx]]-=1;
    if(color_obj[ob[random_idx]]==0)
    {
      color_obj=Object.keys(color_obj).filter(key=>
        key!=ob[random_idx]).reduce((newObj,key)=>{
          newObj[key]=color_obj[key];
          return newObj;
        },{});
    }
  }
}
}

onSelectedImage(image_url:any,index:number):void
{
  this.selected_images[index-1]=image_url;
}

onSelectedFile(file:File,index:number):void{
  this.img_file[index-1]=file;
}

async cancel_move(first:string,second:string):Promise<number>
{
  var val=first+second;
  if(val=='RL'||val=='LR'||val=='UD'||val=='DU'||val=='FB'||val=='BF')
    {
      return 1;
    }
    return -1;
}

async scramble_generator(nums_move:number,notations:string[])
{
  let move:string='';
  let before_move:string='';
  var res='';
  for(let i=0;i<nums_move;i++)
    {
      do{
        let index=Math.floor(Math.random()*6);
        move=notations[index];
      }while(move==before_move || await this.cancel_move(move,before_move)==1)
     before_move=move;
     let mod=Math.floor((Math.random()*3))+1;
     switch(mod)
     {
      case 1:move+=' ';break;
      case 2:move+='2 ';break;
      case 3:move+="' ";break;
     }
     res+=move;
    }
    return res.trim();
}

async switchFront()
{
 if(this.rubikName =="Rubik's 3x3")
  { 
    var first_color=_.cloneDeep(this.rubik_block_color[11]);
    var second_color=_.cloneDeep(this.rubik_block_color[14]);
    var third_color=_.cloneDeep(this.rubik_block_color[17]);
    var second_face_color =_.cloneDeep(this.rubik_block_color[19]);
    var third_face_color = _.cloneDeep(this.rubik_block_color[20]);
    this.rubik_block_color[20]=this.rubik_block_color[18];
    this.rubik_block_color[18]=this.rubik_block_color[24];
    this.rubik_block_color[19]=this.rubik_block_color[21];
    this.rubik_block_color[21]=this.rubik_block_color[25];
    this.rubik_block_color[24]=this.rubik_block_color[26];
    this.rubik_block_color[25]=this.rubik_block_color[23];
    this.rubik_block_color[26]=third_face_color;
    this.rubik_block_color[23]=second_face_color;
    this.rubik_block_color[11]=this.rubik_block_color[45];
    this.rubik_block_color[14]=this.rubik_block_color[46];
    this.rubik_block_color[17]=this.rubik_block_color[47];
    this.rubik_block_color[45]=this.rubik_block_color[33];
    this.rubik_block_color[46]=this.rubik_block_color[30];
    this.rubik_block_color[47]=this.rubik_block_color[27];
    this.rubik_block_color[27]=this.rubik_block_color[6];
    this.rubik_block_color[30]=this.rubik_block_color[7];
    this.rubik_block_color[33]=this.rubik_block_color[8];
    this.rubik_block_color[6]=third_color;
    this.rubik_block_color[7]=second_color;
    this.rubik_block_color[8]=first_color;
  }
}

async switchBack()
{
  if(this.rubikName=="Rubik's 3x3")
    { 
      var first_color=_.cloneDeep(this.rubik_block_color[29]);
      var second_color=_.cloneDeep(this.rubik_block_color[32]);
      var second_face_color=_.cloneDeep(this.rubik_block_color[37]);
      var third_face_color = _.cloneDeep(this.rubik_block_color[38]);
      this.rubik_block_color[38]=this.rubik_block_color[36];
      this.rubik_block_color[36]=this.rubik_block_color[42];
      this.rubik_block_color[37]=this.rubik_block_color[39];
      this.rubik_block_color[39]=this.rubik_block_color[43];
      this.rubik_block_color[42]=this.rubik_block_color[44];
      this.rubik_block_color[43]=this.rubik_block_color[41];
      this.rubik_block_color[44]=third_face_color;
      this.rubik_block_color[41]=second_face_color;
      var third_color=_.cloneDeep(this.rubik_block_color[35]);
      this.rubik_block_color[29]=this.rubik_block_color[53];
      this.rubik_block_color[32]=this.rubik_block_color[52];
      this.rubik_block_color[35]=this.rubik_block_color[51];
      this.rubik_block_color[51]=this.rubik_block_color[9];
      this.rubik_block_color[52]=this.rubik_block_color[12];
      this.rubik_block_color[53]=this.rubik_block_color[15];
      this.rubik_block_color[9]=this.rubik_block_color[2];
      this.rubik_block_color[12]=this.rubik_block_color[1];
      this.rubik_block_color[15]=this.rubik_block_color[0];
      this.rubik_block_color[0]=first_color;
      this.rubik_block_color[1]=second_color;
      this.rubik_block_color[2]=third_color;
    }
}
async switchLeft()
{
if(this.rubikName=="Rubik's 3x3")
  {
    var first_color=_.cloneDeep(this.rubik_block_color[18]);
    var second_color=_.cloneDeep(this.rubik_block_color[21]);
    var third_color=_.cloneDeep(this.rubik_block_color[24]);
    var second_face_color =_.cloneDeep(this.rubik_block_color[10]);
    var third_face_color =_.cloneDeep(this.rubik_block_color[11]);
    this.rubik_block_color[11]=this.rubik_block_color[9];
    this.rubik_block_color[9]=this.rubik_block_color[15];
    this.rubik_block_color[10]=this.rubik_block_color[12];
    this.rubik_block_color[12]=this.rubik_block_color[16];
    this.rubik_block_color[15]=this.rubik_block_color[17];
    this.rubik_block_color[16]=this.rubik_block_color[14];
    this.rubik_block_color[17]=third_face_color;
    this.rubik_block_color[14]=second_face_color;
    this.rubik_block_color[18]=this.rubik_block_color[0];
    this.rubik_block_color[21]=this.rubik_block_color[3];
    this.rubik_block_color[24]=this.rubik_block_color[6];
    this.rubik_block_color[0]=this.rubik_block_color[44];
    this.rubik_block_color[3]=this.rubik_block_color[41];
    this.rubik_block_color[6]=this.rubik_block_color[38];
    this.rubik_block_color[38]=this.rubik_block_color[51];
    this.rubik_block_color[41]=this.rubik_block_color[48];
    this.rubik_block_color[44]=this.rubik_block_color[45];
    this.rubik_block_color[45]=first_color;
    this.rubik_block_color[48]=second_color;
    this.rubik_block_color[51]=third_color;
  }
}

async switchRight()
{
if(this.rubikName=="Rubik's 3x3")
  {
    var first_color=_.cloneDeep(this.rubik_block_color[20]);
    var second_color=_.cloneDeep(this.rubik_block_color[23]);
    var third_color = _.cloneDeep(this.rubik_block_color[26]);
    var second_face_color = _.cloneDeep(this.rubik_block_color[28]);
    var third_face_color = _.cloneDeep(this.rubik_block_color[29]);
    this.rubik_block_color[29]=this.rubik_block_color[27];
    this.rubik_block_color[27]=this.rubik_block_color[33];
    this.rubik_block_color[28]=this.rubik_block_color[30];
    this.rubik_block_color[30]=this.rubik_block_color[34];
    this.rubik_block_color[33]=this.rubik_block_color[35];
    this.rubik_block_color[34]=this.rubik_block_color[32];
    this.rubik_block_color[35]=third_face_color;
    this.rubik_block_color[32]=second_face_color;
    this.rubik_block_color[20]=this.rubik_block_color[47];
    this.rubik_block_color[23]=this.rubik_block_color[50];
    this.rubik_block_color[26]=this.rubik_block_color[53];
    this.rubik_block_color[47]=this.rubik_block_color[42];
    this.rubik_block_color[50]=this.rubik_block_color[39];
    this.rubik_block_color[53]=this.rubik_block_color[36];
    this.rubik_block_color[36]=this.rubik_block_color[8];
    this.rubik_block_color[39]=this.rubik_block_color[5];
    this.rubik_block_color[42]=this.rubik_block_color[2];
    this.rubik_block_color[2]=first_color;
    this.rubik_block_color[5]=second_color;
    this.rubik_block_color[8]=third_color;
  }
}

async switchUp()
{
 if(this.rubikName=="Rubik's 3x3")
  {
    var first_color =_.cloneDeep(this.rubik_block_color[18]);
    var second_color =_.cloneDeep(this.rubik_block_color[19]);
    var third_color=_.cloneDeep(this.rubik_block_color[20]);
    var face_second_color=_.cloneDeep(this.rubik_block_color[1]);
    var face_third_color=_.cloneDeep(this.rubik_block_color[2]);
    this.rubik_block_color[1]=this.rubik_block_color[3];
    this.rubik_block_color[2]=this.rubik_block_color[0];
    this.rubik_block_color[0]=this.rubik_block_color[6];
    this.rubik_block_color[3]=this.rubik_block_color[7];
    this.rubik_block_color[6]=this.rubik_block_color[8];
    this.rubik_block_color[7]=this.rubik_block_color[5];
    this.rubik_block_color[8]=face_third_color;
    this.rubik_block_color[5]=face_second_color;
    this.rubik_block_color[18]=this.rubik_block_color[27];
    this.rubik_block_color[19]=this.rubik_block_color[28];
    this.rubik_block_color[20]=this.rubik_block_color[29];
    this.rubik_block_color[27]=this.rubik_block_color[36];
    this.rubik_block_color[28]=this.rubik_block_color[37];
    this.rubik_block_color[29]=this.rubik_block_color[38];
    this.rubik_block_color[36]=this.rubik_block_color[9];
    this.rubik_block_color[37]=this.rubik_block_color[10];
    this.rubik_block_color[38]=this.rubik_block_color[11];
    this.rubik_block_color[9]=first_color;
    this.rubik_block_color[10]=second_color;
    this.rubik_block_color[11]=third_color;
  }
}
async switchDown()
{
  if(this.rubikName=="Rubik's 3x3")
    {
      var first_color=_.cloneDeep(this.rubik_block_color[24]);
      var second_color=_.cloneDeep(this.rubik_block_color[25]);
      var third_color=_.cloneDeep(this.rubik_block_color[26]);
      var second_face_color=_.cloneDeep(this.rubik_block_color[46]);
      var third_face_color=_.cloneDeep(this.rubik_block_color[47]);
      this.rubik_block_color[47]=this.rubik_block_color[45];
      this.rubik_block_color[45]=this.rubik_block_color[51];
      this.rubik_block_color[46]=this.rubik_block_color[48];
      this.rubik_block_color[48]=this.rubik_block_color[52];
      this.rubik_block_color[51]=this.rubik_block_color[53];
      this.rubik_block_color[52]=this.rubik_block_color[50];
      this.rubik_block_color[53]=third_face_color;
      this.rubik_block_color[50]=second_face_color;
      this.rubik_block_color[24]=this.rubik_block_color[15];
      this.rubik_block_color[25]=this.rubik_block_color[16];
      this.rubik_block_color[26]=this.rubik_block_color[17];
      this.rubik_block_color[15]=this.rubik_block_color[42];
      this.rubik_block_color[16]=this.rubik_block_color[43];
      this.rubik_block_color[17]=this.rubik_block_color[44];
      this.rubik_block_color[42]=this.rubik_block_color[33];
      this.rubik_block_color[43]=this.rubik_block_color[34];
      this.rubik_block_color[44]=this.rubik_block_color[35];
      this.rubik_block_color[33]=first_color;
      this.rubik_block_color[34]=second_color;
      this.rubik_block_color[35]=third_color;
    }
}

async switchReverseFront()
{
if(this.rubikName=="Rubik's 3x3")
{
  var first_color=_.cloneDeep(this.rubik_block_color[27]);
  var second_color=_.cloneDeep(this.rubik_block_color[30]);
  var third_color=_.cloneDeep(this.rubik_block_color[33]);
  var second_face_color =_.cloneDeep(this.rubik_block_color[19]);
  var third_face_color = _.cloneDeep(this.rubik_block_color[18]);
  this.rubik_block_color[18]=this.rubik_block_color[20];
  this.rubik_block_color[20]=this.rubik_block_color[26];
  this.rubik_block_color[19]=this.rubik_block_color[23];
  this.rubik_block_color[23]=this.rubik_block_color[25];
  this.rubik_block_color[26]=this.rubik_block_color[24];
  this.rubik_block_color[25]=this.rubik_block_color[21];
  this.rubik_block_color[21]=second_face_color;
  this.rubik_block_color[24]=third_face_color;
  this.rubik_block_color[27]=this.rubik_block_color[47];
  this.rubik_block_color[30]=this.rubik_block_color[46];
  this.rubik_block_color[33]=this.rubik_block_color[45];
  this.rubik_block_color[45]=this.rubik_block_color[11];
  this.rubik_block_color[46]=this.rubik_block_color[14];
  this.rubik_block_color[47]=this.rubik_block_color[17];
  this.rubik_block_color[11]=this.rubik_block_color[8];
  this.rubik_block_color[14]=this.rubik_block_color[7];
  this.rubik_block_color[17]=this.rubik_block_color[6];
  this.rubik_block_color[6]=first_color;
  this.rubik_block_color[7]=second_color;
  this.rubik_block_color[8]=third_color;
}
}

async switchReverseBack()
{
  if(this.rubikName=="Rubik's 3x3")
  {
    var first_color=_.cloneDeep(this.rubik_block_color[0]);
    var second_color=_.cloneDeep(this.rubik_block_color[1]);
    var third_color=_.cloneDeep(this.rubik_block_color[2]);
    var second_face_color=_.cloneDeep(this.rubik_block_color[37]);
    var third_face_color=_.cloneDeep(this.rubik_block_color[36]);
    this.rubik_block_color[36]=this.rubik_block_color[38];
    this.rubik_block_color[37]=this.rubik_block_color[41];
    this.rubik_block_color[38]=this.rubik_block_color[44];
    this.rubik_block_color[41]=this.rubik_block_color[43];
    this.rubik_block_color[44]=this.rubik_block_color[42];
    this.rubik_block_color[43]=this.rubik_block_color[39];
    this.rubik_block_color[42]=third_face_color;
    this.rubik_block_color[39]=second_face_color;
    this.rubik_block_color[0]=this.rubik_block_color[15];
    this.rubik_block_color[1]=this.rubik_block_color[12];
    this.rubik_block_color[2]=this.rubik_block_color[9];
    this.rubik_block_color[9]=this.rubik_block_color[51];
    this.rubik_block_color[12]=this.rubik_block_color[52];
    this.rubik_block_color[15]=this.rubik_block_color[53];
    this.rubik_block_color[51]=this.rubik_block_color[35];
    this.rubik_block_color[52]=this.rubik_block_color[32];
    this.rubik_block_color[53]=this.rubik_block_color[29];
    this.rubik_block_color[29]=first_color;
    this.rubik_block_color[32]=second_color;
    this.rubik_block_color[35]=third_color;
  }
}

async switchReverseLeft()
{
  if(this.rubikName=="Rubik's 3x3")
    {
      var first_color = _.cloneDeep(this.rubik_block_color[18]);
      var second_color =_.cloneDeep(this.rubik_block_color[21]);
      var third_color = _.cloneDeep(this.rubik_block_color[24]);
      var second_face_color =_.cloneDeep(this.rubik_block_color[10]);
      var third_face_color = _.cloneDeep(this.rubik_block_color[9]);

      this.rubik_block_color[9]=this.rubik_block_color[11];
      this.rubik_block_color[10]=this.rubik_block_color[14];
      this.rubik_block_color[11]=this.rubik_block_color[17];
      this.rubik_block_color[14]=this.rubik_block_color[16];
      this.rubik_block_color[17]=this.rubik_block_color[15];
      this.rubik_block_color[16]=this.rubik_block_color[12];
      this.rubik_block_color[15]=third_face_color;
      this.rubik_block_color[12]=second_face_color;

      this.rubik_block_color[18]=this.rubik_block_color[45];
      this.rubik_block_color[21]=this.rubik_block_color[48];    
      this.rubik_block_color[24]=this.rubik_block_color[51];
      this.rubik_block_color[45]=this.rubik_block_color[44];
      this.rubik_block_color[48]=this.rubik_block_color[41];
      this.rubik_block_color[51]=this.rubik_block_color[38];
      this.rubik_block_color[38]=this.rubik_block_color[6];
      this.rubik_block_color[41]=this.rubik_block_color[3];
      this.rubik_block_color[44]=this.rubik_block_color[0];
      this.rubik_block_color[0]=first_color;
      this.rubik_block_color[3]=second_color;
      this.rubik_block_color[6]=third_color;
    }
}

async switchReverseRight()
{
  var first_color = _.cloneDeep(this.rubik_block_color[20]);
  var second_color =_.cloneDeep(this.rubik_block_color[23]);
  var third_color = _.cloneDeep(this.rubik_block_color[26]);
  var second_face_color =_.cloneDeep(this.rubik_block_color[28]);
  var third_face_color = _.cloneDeep(this.rubik_block_color[27]);

  this.rubik_block_color[27]=this.rubik_block_color[29];
  this.rubik_block_color[28]=this.rubik_block_color[32];
  this.rubik_block_color[29]=this.rubik_block_color[35];
  this.rubik_block_color[32]=this.rubik_block_color[34];
  this.rubik_block_color[35]=this.rubik_block_color[33];
  this.rubik_block_color[34]=this.rubik_block_color[30];
  this.rubik_block_color[33]=third_face_color;
  this.rubik_block_color[30]=second_face_color;

  this.rubik_block_color[20]=this.rubik_block_color[2];
  this.rubik_block_color[23]=this.rubik_block_color[5];    
  this.rubik_block_color[26]=this.rubik_block_color[8];
  this.rubik_block_color[2]=this.rubik_block_color[42];
  this.rubik_block_color[5]=this.rubik_block_color[39];
  this.rubik_block_color[8]=this.rubik_block_color[36];
  this.rubik_block_color[36]=this.rubik_block_color[53];
  this.rubik_block_color[39]=this.rubik_block_color[50];
  this.rubik_block_color[42]=this.rubik_block_color[47];
  this.rubik_block_color[47]=first_color;
  this.rubik_block_color[50]=second_color;
  this.rubik_block_color[53]=third_color;
}

async switchReverseUp()
{
  if(this.rubikName=="Rubik's 3x3")
  {
    var first_color=_.cloneDeep(this.rubik_block_color[18]);
    var second_color=_.cloneDeep(this.rubik_block_color[19]);
    var third_color=_.cloneDeep(this.rubik_block_color[20]);
    var second_face_color=_.cloneDeep(this.rubik_block_color[1]);
    var third_face_color = _.cloneDeep(this.rubik_block_color[0]);
    this.rubik_block_color[0]=this.rubik_block_color[2];
    this.rubik_block_color[1]=this.rubik_block_color[5];
    this.rubik_block_color[2]=this.rubik_block_color[8];
    this.rubik_block_color[5]=this.rubik_block_color[7];
    this.rubik_block_color[8]=this.rubik_block_color[6];
    this.rubik_block_color[7]=this.rubik_block_color[3];
    this.rubik_block_color[6]=third_face_color;
    this.rubik_block_color[3]=second_face_color;
    this.rubik_block_color[18]=this.rubik_block_color[9];
    this.rubik_block_color[19]=this.rubik_block_color[10];
    this.rubik_block_color[20]=this.rubik_block_color[11];
    this.rubik_block_color[9]=this.rubik_block_color[36];
    this.rubik_block_color[10]=this.rubik_block_color[37];
    this.rubik_block_color[11]=this.rubik_block_color[38];
    this.rubik_block_color[36]=this.rubik_block_color[27];
    this.rubik_block_color[37]=this.rubik_block_color[28];
    this.rubik_block_color[38]=this.rubik_block_color[29];
    this.rubik_block_color[27]=first_color;
    this.rubik_block_color[28]=second_color;
    this.rubik_block_color[29]=third_color;
  }
}

async switchReverseDown()
{
  if(this.rubikName=="Rubik's 3x3")
  {
    var first_color=_.cloneDeep(this.rubik_block_color[24]);
    var second_color=_.cloneDeep(this.rubik_block_color[25]);
    var third_color=_.cloneDeep(this.rubik_block_color[26]);
    var second_face_color = _.cloneDeep(this.rubik_block_color[46]);
    var third_face_color = _.cloneDeep(this.rubik_block_color[45]);
    this.rubik_block_color[45] = this.rubik_block_color[47];
    this.rubik_block_color[46]=this.rubik_block_color[50];
    this.rubik_block_color[47]=this.rubik_block_color[53];
    this.rubik_block_color[50]=this.rubik_block_color[52];
    this.rubik_block_color[53]=this.rubik_block_color[51];
    this.rubik_block_color[52]=this.rubik_block_color[48];
    this.rubik_block_color[51]=third_face_color;
    this.rubik_block_color[48]=second_face_color;
    this.rubik_block_color[24]=this.rubik_block_color[33];
    this.rubik_block_color[25]=this.rubik_block_color[34];
    this.rubik_block_color[26]=this.rubik_block_color[35];
    this.rubik_block_color[33]=this.rubik_block_color[42];
    this.rubik_block_color[34]=this.rubik_block_color[43];
    this.rubik_block_color[35]=this.rubik_block_color[44];
    this.rubik_block_color[42]=this.rubik_block_color[15];
    this.rubik_block_color[43]=this.rubik_block_color[16];
    this.rubik_block_color[44]=this.rubik_block_color[17];
    this.rubik_block_color[15]=first_color;
    this.rubik_block_color[16]=second_color;
    this.rubik_block_color[17]=third_color;
  }
}

 async rotationDirection(direct:string)
 {
  switch(direct)
  {
    case "F":this.switchFront();break;
    case "B":this.switchBack();break;
    case "L":this.switchLeft();break;
    case "R":this.switchRight();break;
    case "U":this.switchUp();break;
    case "D":this.switchDown();break;
    case "F'":this.switchReverseFront();break;
    case "B'":this.switchReverseBack();break;
    case "L'":this.switchReverseLeft();break;
    case "R'":this.switchReverseRight();break;
    case "U'":this.switchReverseUp();break;
    case "D'":this.switchReverseDown();break;
  }
 }



 async rotationSolveRubik(solve_value:string)
 { 
 var num_times=parseInt(solve_value.replace(/\D/g,''));
      for(let i=0;i<num_times;i++)
        {
      solve_value=solve_value.replace(/\d/g,'');
      this.rotationDirection(solve_value);
      await this.delay(200);      
        }    
 }

 async scrambleRubikBlock()
  { 
   
   if(this.selected_images.length==1)
    { 
   var formData= new FormData();
   var original_state = this.getCurrentCubeState(this.rubik_block_color);
   formData.append('original_cube',original_state);
   try
   {
    this.img_file.forEach((file, index) => 
    {
    formData.append('images', file, file.name);
    });

    for(let i=0;i<6;i++)
      { 
        formData.append('arr[]',this.nums_of_face[i]);
      }
    }
  catch(error)
  {
    alert(error.message);
  }
    await this.handleService.sendImage(formData);
    }
  else{
    var cube_notations=['U','F','R','L','D','B'];
    var pattern=await this.scramble_generator(30,cube_notations);
          
    var val=pattern.split(' ');
    for(let direct of val)
      {
        if(direct.includes('2'))
          {
            direct=direct.replace(/\d/g,"");
            await this.rotationDirection(direct);
            await this.rotationDirection(direct);
          }
        else
        {
         await this.rotationDirection(direct);
        }
        await this.delay(100);
      }
    }
  }
  
  getCurrentFaceState(rb_face:string[])
  {
    var face_state='';
    for(let i =0;i<rb_face.length;i++)
      {
       face_state+=this.convertColorToNotation(rb_face[i]);
      }
      return face_state;
  }

  getCurrentCubeState(rubik_cube:string[])
{
  var upper_face=rubik_cube.slice(0,9);
  var right_face = rubik_cube.slice(27,36);
  var front_face=rubik_cube.slice(18,27);
  var down_face= rubik_cube.slice(45,54);
  var left_face=rubik_cube.slice(9,18);
  var back_face=rubik_cube.slice(36,45);
  var face_list = [upper_face,right_face,front_face,down_face,left_face,back_face];
  var original_face = '';

  for(let face of face_list)
    {
    original_face+=this.getCurrentFaceState(face);
    }
    return original_face;
}
  async solveRubik()
  {    
  // await this.switchRight();
  // await this.switchDown();
  // await this.switchRight();
  // await this.switchDown();
  // await this.switchFront();
  // await this.switchLeft();
  //await this.switchRight();
  // await this.switchLeft();
    // await this.switchReverseFront();
    //await this.switchRight();
    // await this.switchUp();
    // await this.switchReverseLeft();
    // await this.switchDown();
    // await this.switchUp();
    // await this.switchLeft();
    // await this.switchDown();
    // await this.switchBack();
    // await this.switchLeft();
    // await this.switchBack();
    // await this.switchLeft();
    // await this.switchFront();
    // await this.switchUp();
    // await this.switchRight();
    // await this.switchLeft();
    // await this.switchDown();

    //await this.switchReverseRight();

    //await this.switchReverseLeft();

  var rubik_cube=  this.rubik_block_color;
  var upper_face=rubik_cube.slice(0,9);
  var right_face = rubik_cube.slice(27,36);
  var front_face=rubik_cube.slice(18,27);
  var down_face= rubik_cube.slice(45,54);
  var left_face=rubik_cube.slice(9,18);
  var back_face=rubik_cube.slice(36,45);
  var manual_ordered_face =upper_face.concat(right_face,front_face,down_face,left_face,back_face);
  
  var res=this.rubikName=="Rubik's 3x3"?await this.handleService.solveRubik(this.rubikName,this.username,manual_ordered_face):await this.handleService.solveRubik(this.rubikName,this.username,this.rubik_2x2_block_color);
  var solve_res=res.split(' ');

  for(let i=0;i<solve_res.length-1;i++)
    { 
      await this.rotationSolveRubik(solve_res[i]);
    }
  
  // var sol_res='';
  // if(res!=null)
  // {  
  //    var res_handle=res.split(' ');
  //    for(let i=0;i<res_handle.length-1;i++)
  //     {
  //       var command=Array.from(res_handle[i]);
  //       sol_res+=command[0].repeat(parseInt(command[1]));
  //     }
  //     sol_res=sol_res.trim();
  // }
  //var init_ers=await this.handleService.initMqtt();


  // var transmit=await this.handleService.transmitMqtt("gud sier","test");
  }

  ngOnDestroy(){
    // Clean up animation frame when component is destroyed
    if(this.animationFrameId){
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId=null;
    }
  }

  private getActiveFlatRefs(): { container?: HTMLElement, cube?: HTMLElement } {
    // Determine which flat view is currently rendered based on cube type
    const container = this.rubikName=="Rubik's 3x3" ? this.flatContainer3x3?.nativeElement : this.flatContainer2x2?.nativeElement;
    const cube = this.rubikName=="Rubik's 3x3" ? this.flatCube3x3?.nativeElement : this.flatCube2x2?.nativeElement;
    return { container, cube };
  }

  private applyFlatScaleFit(): void {
    const { container, cube } = this.getActiveFlatRefs();
    if(!container || !cube) return;

    const containerRect = container.getBoundingClientRect();
    const cubeRect = cube.getBoundingClientRect();
    if(cubeRect.width === 0 || cubeRect.height === 0) {
      return;
    }

    // Estimate natural size without clearing transforms by dividing by current scale
    const currentScale = this.getElementScale(cube);
    const naturalWidth = currentScale > 0 ? (cubeRect.width / currentScale) : cubeRect.width;
    const naturalHeight = currentScale > 0 ? (cubeRect.height / currentScale) : cubeRect.height;

    // Add a small margin so unfolding never touches the edge
    const marginFactor = 0.96;
    const scaleX = (containerRect.width * marginFactor) / naturalWidth;
    const scaleY = (containerRect.height * marginFactor) / naturalHeight;
    const fitScale = Math.min(scaleX, scaleY, 1);

    cube.style.transformOrigin = 'center center';
    cube.style.transform = `scale(${fitScale})`;
  }

  private getElementScale(el: HTMLElement): number {
    const style = getComputedStyle(el);
    const transform = style.transform || '';
    // matrix(a, b, c, d, e, f) -> scaleX = a
    // matrix3d(a1, ..., a11, a12, a13, a14, a15, a16) -> scaleX = a1
    if (transform.startsWith('matrix3d(')) {
      const values = transform.slice(9, -1).split(',').map(v => parseFloat(v.trim()));
      if (values.length >= 16 && !Number.isNaN(values[0])) return Math.abs(values[0]);
    } else if (transform.startsWith('matrix(')) {
      const values = transform.slice(7, -1).split(',').map(v => parseFloat(v.trim()));
      if (values.length >= 6 && !Number.isNaN(values[0])) return Math.abs(values[0]);
    }
    return 1;
  }

  private clearFlatScale(): void {
    const { cube } = this.getActiveFlatRefs();
    if(!cube) return;
    cube.style.transform = '';
  }

  private runFlatScaleLoop(durationMs: number): void {
    const start = performance.now();
    const loop = () => {
      if(!this.transitioningToFlat) return;
      const now = performance.now();
      this.applyFlatScaleFit();
      if(now - start < durationMs) {
        requestAnimationFrame(loop);
      }
    };
    requestAnimationFrame(loop);
  }

  private startFlatAutoFit(): void {
    const { container } = this.getActiveFlatRefs();
    if(!container) return;
    if(this.flatResizeObserver){
      this.flatResizeObserver.disconnect();
      this.flatResizeObserver = undefined;
    }
    // Observe container size changes
    this.flatResizeObserver = new ResizeObserver(() => {
      this.applyFlatScaleFit();
    });
    this.flatResizeObserver.observe(container);
    // Initial fit
    this.applyFlatScaleFit();
  }

  private stopFlatAutoFit(): void {
    if(this.flatResizeObserver){
      this.flatResizeObserver.disconnect();
      this.flatResizeObserver = undefined;
    }
    this.clearFlatScale();
  }
}
