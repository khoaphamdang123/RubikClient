export interface IRubik
{
    id?:number;
    name:string;
    description:string;
    avatar:string;
    features:string;
    feature?:string;
    // Category reference uses MongoDB ObjectId string
    category_id?:string;
}