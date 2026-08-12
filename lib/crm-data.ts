export type CompanyKey = "cpte" | "pose" | "instal" | "pac";
export type SupplierOffer = { supplier:string; supplierName:string; reference:string; brand:string; price:number; packaging:string; packagingType:"modifiable"|"fixed" };
export type Product = { id:number; name:string; family:string; unit:string; offers:SupplierOffer[] };
export type Order = { id:string; supplier:string; date:string; total:number; status:"Brouillon"|"Envoyée"|"Reçue"; products:number };

export const companies:{key:CompanyKey;name:string;short:string;color:string}[]=[
  {key:"cpte",name:"CPTE Conseil",short:"CPTE",color:"#2563eb"},
  {key:"pose",name:"HM Pose",short:"POSE",color:"#14b8a6"},
  {key:"instal",name:"HM Instal",short:"INSTAL",color:"#8b5cf6"},
  {key:"pac",name:"HM PAC",short:"PAC",color:"#f59e0b"},
];
export const products:Product[]=[
 {id:1,name:"Vis à bois 5 × 70",family:"Visserie",unit:"Boîte",offers:[
  {supplier:"IS Électrique",supplierName:"VIS BOIS TF 5X70 TX25",reference:"VIS-570-TX",brand:"Spax",price:18.4,packaging:"Boîte de 200",packagingType:"fixed"},
  {supplier:"Rexel",supplierName:"VIS BOIS 5X70 TORX",reference:"RXL-785410",brand:"Fischer",price:19.1,packaging:"Boîte de 200",packagingType:"fixed"}]},
 {id:2,name:"Câble R2V 3G2,5",family:"Câbles",unit:"Couronne",offers:[
  {supplier:"IS Électrique",supplierName:"U1000 R2V 3G2.5 COUPE",reference:"R2V3G25",brand:"Nexans",price:43.8,packaging:"Couronne de 30 m",packagingType:"modifiable"},
  {supplier:"Sonepar",supplierName:"CABLE R2V 3G2,5MM²",reference:"SNP-301184",brand:"Prysmian",price:41.9,packaging:"Couronne de 30 m",packagingType:"modifiable"}]},
 {id:3,name:"Cheville à frapper 8 × 80",family:"Fixation",unit:"Boîte",offers:[{supplier:"IS Électrique",supplierName:"CHEVILLE FRAPPER 8X80",reference:"CH-880",brand:"Fischer",price:24.5,packaging:"Boîte de 100",packagingType:"fixed"}]},
 {id:4,name:"Collier noir 4,8 × 300",family:"Fixation",unit:"Sachet",offers:[{supplier:"Rexel",supplierName:"COLLIER 4,8X300 NOIR UV",reference:"RXL-44320",brand:"Legrand",price:12.2,packaging:"Sachet de 100",packagingType:"fixed"}]},
 {id:5,name:"Gaine ICTA Ø 20",family:"Gaines",unit:"Couronne",offers:[{supplier:"Sonepar",supplierName:"ICTA 3422 D20 PRE-FILEE",reference:"SNP-ICTA20",brand:"Courant",price:34.7,packaging:"Couronne de 25 m",packagingType:"fixed"}]},
];
export const initialOrders:Order[]=[
 {id:"CMD-2026-048",supplier:"IS Électrique",date:"12 août 2026",total:1842.6,status:"Envoyée",products:8},
 {id:"CMD-2026-047",supplier:"Sonepar",date:"8 août 2026",total:967.2,status:"Reçue",products:5},
 {id:"CMD-2026-046",supplier:"Rexel",date:"4 août 2026",total:431.8,status:"Brouillon",products:3},
 {id:"CMD-2026-045",supplier:"IS Électrique",date:"29 juillet 2026",total:2290.4,status:"Reçue",products:11},
];
export const money=(value:number)=>new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(value);
