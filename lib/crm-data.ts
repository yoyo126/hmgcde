export type CompanyKey="cpte"|"pose"|"instal"|"pac";
export type SupplierOffer={supplier:string;supplierName:string;reference:string;brand:string;price:number;packaging:string;packagingType:"modifiable"|"fixed"};
export type Product={id:number;name:string;family:string;subfamily:string;unit:string;kind:"simple"|"ensemble";contents?:string[];offers:SupplierOffer[]};
export type Order={id:string;supplier:string;date:string;total:number;status:"Brouillon"|"Envoyée"|"Reçue";products:number};

export const companies:{key:CompanyKey;name:string;short:string;color:string}[]=[
 {key:"cpte",name:"CPTE Conseil",short:"CPTE",color:"#2563eb"},{key:"pose",name:"HM Pose",short:"POSE",color:"#14b8a6"},
 {key:"instal",name:"HM Instal",short:"INSTAL",color:"#8b5cf6"},{key:"pac",name:"HM PAC",short:"PAC",color:"#f59e0b"},
];

type Seed={name:string;family:"Électricité"|"Climatisation"|"Plomberie";subfamily:string;unit:string;packaging:string;price?:number;reference?:string;modifiable?:boolean;contents?:string[]};
const electrical:Seed[]=[
 {name:"H07V-K 6 vert/jaune",family:"Électricité",subfamily:"Câbles",unit:"Couronne",packaging:"Couronne de 100 m",modifiable:true},
 {name:"H07V-R 1×16 vert/jaune",family:"Électricité",subfamily:"Câbles",unit:"Couronne",packaging:"Couronne de 50 m",modifiable:true},
 {name:"R2V 3G2,5",family:"Électricité",subfamily:"Câbles",unit:"Couronne",packaging:"Couronne de 20 m",modifiable:true},
 {name:"R2V 3G4",family:"Électricité",subfamily:"Câbles",unit:"Couronne",packaging:"Couronne de 30 m",modifiable:true},
 {name:"R2V 3G6",family:"Électricité",subfamily:"Câbles",unit:"Couronne",packaging:"Couronne de 30 m",modifiable:true},
 {name:"R2V 4G1,5",family:"Électricité",subfamily:"Câbles",unit:"Couronne",packaging:"Couronne de 20 m",modifiable:true},
 {name:"R2V 5G2,5",family:"Électricité",subfamily:"Câbles",unit:"Couronne",packaging:"Couronne de 20 m",modifiable:true},
 {name:"R2V 5G4",family:"Électricité",subfamily:"Câbles",unit:"Couronne",packaging:"Couronne de 30 m",modifiable:true},
 {name:"R2V 2×10",family:"Électricité",subfamily:"Câbles",unit:"Couronne",packaging:"Couronne de 10 m",modifiable:true},
 {name:"R2V 4×10",family:"Électricité",subfamily:"Câbles",unit:"Couronne",packaging:"Couronne de 10 m",modifiable:true},
 {name:"R2V 3G16 T",family:"Électricité",subfamily:"Câbles",unit:"Couronne",packaging:"Couronne de 10 m",modifiable:true},
 {name:"Hiflex-CY 2×0,75 LIYCY",family:"Électricité",subfamily:"Câbles",unit:"Couronne",packaging:"Couronne de 20 m",modifiable:true},
 {name:"Hiflex-CY 5×0,75 LIYCY",family:"Électricité",subfamily:"Câbles",unit:"Couronne",packaging:"Couronne de 20 m",modifiable:true},
 {name:"R2V 5G10",family:"Électricité",subfamily:"Câbles",unit:"Couronne",packaging:"Couronne de 10 m",modifiable:true},
 {name:"Gaine ICT diamètre 32",family:"Électricité",subfamily:"Gaines et conduits",unit:"Couronne",packaging:"Couronne de 50 m",price:25},
 {name:"Conduit isolant rigide lisse IRL 332",family:"Électricité",subfamily:"Gaines et conduits",unit:"Botte",packaging:"Botte de 30",price:22.8},
 {name:"Manchon diamètre 32",family:"Électricité",subfamily:"Gaines et conduits",unit:"Sachet",packaging:"Sachet de 30",price:5.57},
 {name:"Attache tube embase + collier",family:"Électricité",subfamily:"Fixations",unit:"Sachet",packaging:"Sachet de 100",price:22.51},
 {name:"Cheville béton",family:"Électricité",subfamily:"Fixations",unit:"Boîte",packaging:"Boîte de 200",price:9.9},
 {name:"Cheville placo GKM-S",family:"Électricité",subfamily:"Fixations",unit:"Boîte",packaging:"Boîte de 150",price:24.8},
 {name:"Scotch blanc électrique 15×10",family:"Électricité",subfamily:"Consommables",unit:"Sachet",packaging:"Sachet de 10",price:3.6},
 {name:"Electro Tap jaune",family:"Électricité",subfamily:"Consommables",unit:"Sachet",packaging:"Sachet de 100",price:23.1},
 {name:"Cosses anneaux jaunes 6²-6",family:"Électricité",subfamily:"Consommables",unit:"Sachet",packaging:"Sachet de 100",price:18.9},
 {name:"Répartiteur de terre 5 départs",family:"Électricité",subfamily:"Protections",unit:"Pièce",packaging:"Pièce",price:12.3},
 {name:"Vis à bois Power 5×40",family:"Électricité",subfamily:"Fixations",unit:"Boîte",packaging:"Boîte de 200",price:8.36},
 {name:"Vis à bois Power 5×70",family:"Électricité",subfamily:"Fixations",unit:"Boîte",packaging:"Boîte de 200",price:13.54},
 {name:"Prise 2P+T 16A 250V saillie",family:"Électricité",subfamily:"Appareillage",unit:"Pièce",packaging:"Pièce",price:5.06},
 {name:"Borne Wago 221 mini 3×6 mm² à levier",family:"Électricité",subfamily:"Connexions",unit:"Boîte",packaging:"Boîte de 50",price:17.08},
 {name:"Boîte IP55 105×105×55",family:"Électricité",subfamily:"Boîtes",unit:"Pièce",packaging:"Pièce",price:2.04},
 {name:"Disjoncteur DNX3 1P+N C16",family:"Électricité",subfamily:"Protections",unit:"Pièce",packaging:"Pièce",price:5.9},
 {name:"Mastic Bostik tuile MSP 133 290 ml",family:"Électricité",subfamily:"Consommables",unit:"Pièce",packaging:"Cartouche",price:8.96},
 {name:"Disjoncteur D20",family:"Électricité",subfamily:"Protections",unit:"Pièce",packaging:"Pièce",price:17.44},
 {name:"Disjoncteur C2",family:"Électricité",subfamily:"Protections",unit:"Pièce",packaging:"Pièce",price:11.33},
 {name:"Disjoncteur C32",family:"Électricité",subfamily:"Protections",unit:"Pièce",packaging:"Pièce",price:8},
 {name:"Disjoncteur C40 triphasé",family:"Électricité",subfamily:"Protections",unit:"Pièce",packaging:"Pièce"},
 {name:"Coffret triphasé",family:"Électricité",subfamily:"Coffrets complets",unit:"Coffret",packaging:"Coffret complet",price:188.9,contents:["1 × disjoncteur différentiel 3P+N C40A 10 kA 30 mA AC","1 × disjoncteur modulaire 1P+N C16","2 × disjoncteurs 3P+N C20 6 kA","1 × coffret vide + barrette"]},
 {name:"Coffret monophasé",family:"Électricité",subfamily:"Coffrets complets",unit:"Coffret",packaging:"Coffret complet",price:81.5,contents:["1 × disjoncteur différentiel 1P+N C63A 30 mA AC","1 × disjoncteur modulaire 1P+N C16","2 × disjoncteurs modulaires 1P+N C32","1 × coffret vide + barrette"]},
 {name:"Coffret monophasé De Dietrich",family:"Électricité",subfamily:"Coffrets complets",unit:"Coffret",packaging:"Coffret complet",price:90.9,contents:["1 × disjoncteur différentiel 1P+N C63A 30 mA AC","1 × disjoncteur C16","1 × disjoncteur C10","1 × disjoncteur C32","1 × disjoncteur C40","1 × coffret vide + barrette"]},
 {name:"Coffret triphasé De Dietrich",family:"Électricité",subfamily:"Coffrets complets",unit:"Coffret",packaging:"Coffret complet",price:194.8,contents:["1 × disjoncteur différentiel 3P+N C40A 10 kA 30 mA AC","1 × disjoncteur C16","1 × disjoncteur C10","2 × disjoncteurs 3P+N C16 6 kA","1 × coffret vide + barrette"]},
];

const climate:Seed[]=[
 {name:"Goulotte 80×60",family:"Climatisation",subfamily:"Goulottes",unit:"Carton",packaging:"Carton de 8",price:6.1},
 {name:"Goulotte 120×60",family:"Climatisation",subfamily:"Goulottes",unit:"Carton",packaging:"Carton de 4",price:8.7},
 {name:"Liaison frigorifique 1/4–3/8",family:"Climatisation",subfamily:"Liaisons frigorifiques",unit:"Couronne",packaging:"Couronne de 20 m",price:91.61},
 {name:"Liaison frigorifique 1/4–1/2",family:"Climatisation",subfamily:"Liaisons frigorifiques",unit:"Couronne",packaging:"Couronne de 20 m",price:108.03},
 {name:"Liaison frigorifique 3/8–5/8",family:"Climatisation",subfamily:"Liaisons frigorifiques",unit:"Couronne",packaging:"Couronne de 20 m",price:164.12},
 {name:"Support Roberfoot Sumo",family:"Climatisation",subfamily:"Supports",unit:"Pièce",packaging:"Pièce",price:25.9},
 {name:"Support mural groupe extérieur",family:"Climatisation",subfamily:"Supports",unit:"Pièce",packaging:"Pièce"},
 {name:"Pompe de relevage ballon Altech",family:"Climatisation",subfamily:"Pompes de relevage",unit:"Pièce",packaging:"Pièce",price:73.24},
 {name:"Pompe de relevage Sauermann",family:"Climatisation",subfamily:"Pompes de relevage",unit:"Pièce",packaging:"Pièce",price:88.5},
 {name:"Cristal",family:"Climatisation",subfamily:"Accessoires",unit:"Pièce",packaging:"Pièce",price:19.95},
 {name:"Groupe de sécurité + siphon",family:"Climatisation",subfamily:"Accessoires",unit:"Ensemble",packaging:"Ensemble complet",price:13.53},
 {name:"Joint d’intersection 80",family:"Climatisation",subfamily:"Accessoires goulottes",unit:"Carton",packaging:"Carton de 30",price:1.36},
 {name:"Joint d’intersection 120",family:"Climatisation",subfamily:"Accessoires goulottes",unit:"Carton",packaging:"Carton de 20",price:1.52},
 {name:"Angle apparent 80",family:"Climatisation",subfamily:"Accessoires goulottes",unit:"Carton",packaging:"Carton de 8",price:4.39},
 {name:"Angle apparent 120",family:"Climatisation",subfamily:"Accessoires goulottes",unit:"Carton",packaging:"Carton de 6",price:5.3},
 {name:"Sortie de mur coudée 80",family:"Climatisation",subfamily:"Accessoires goulottes",unit:"Carton",packaging:"Carton de 6",price:5.37},
 {name:"Sortie de mur coudée 120",family:"Climatisation",subfamily:"Accessoires goulottes",unit:"Carton",packaging:"Carton de 4",price:6.03},
 {name:"Passage de mur 80",family:"Climatisation",subfamily:"Accessoires goulottes",unit:"Carton",packaging:"Carton de 8",price:2.67},
 {name:"Passage de mur 120",family:"Climatisation",subfamily:"Accessoires goulottes",unit:"Carton",packaging:"Carton de 8",price:2.91},
 {name:"Té 80",family:"Climatisation",subfamily:"Accessoires goulottes",unit:"Carton",packaging:"Carton de 4",price:6.56},
 {name:"Té 120",family:"Climatisation",subfamily:"Accessoires goulottes",unit:"Carton",packaging:"Carton de 4",price:7.72},
];

const pacBase=["8 × robinets sphériques mâle/femelle 26×34","4 × robinets sphériques mâle/mâle 26×34","6 × robinets sphériques mâle/mâle 20×27","4 × mamelons mâle/mâle 26/34","1 × purgeur d’air 15×21","2 × réductions mâle/femelle 33/42–26/34","4 × réductions mâle/mâle 33/42–26/34","1 × réduction mâle/femelle 26/34–15/21","1 × réduction mâle/femelle 26/34–20/27","3 × coudes mâle/femelle 26/34","1 × raccord pour circulateur 1½–26/34 F","8 × douilles 3/4 F multicouche 16"];
const plumbing:Seed[]=[
 {name:"Carton plomberie multicouche Ø26 + accessoires",family:"Plomberie",subfamily:"Cartons complets PAC",unit:"Carton",packaging:"Carton complet",contents:["1 × couronne multicouche Ø26 de 50 m","1 × couronne multicouche Ø16 de 100 m",...pacBase,"8 × douilles 26/34 F multicouche 26","15 × coudes 90° multicouche 26"]},
 {name:"Carton plomberie multicouche Ø32 + accessoires",family:"Plomberie",subfamily:"Cartons complets PAC",unit:"Carton",packaging:"Carton complet",contents:["12 × couronnes multicouche Ø32 de 50 m",...pacBase,"12 × douilles 26/34 F multicouche 32","25 × coudes 90° multicouche 32"]},
];

const allSeeds=[...electrical,...climate,...plumbing];
export const products:Product[]=allSeeds.map((seed,index)=>({
 id:index+1,name:seed.name,family:seed.family,subfamily:seed.subfamily,unit:seed.unit,kind:seed.contents?"ensemble":"simple",contents:seed.contents,
 offers:[{supplier:seed.family==="Électricité"?"Fournisseur électrique":seed.family==="Climatisation"?"Fournisseur climatisation":"Fournisseur plomberie",supplierName:seed.name.toUpperCase(),reference:seed.reference||"À renseigner",brand:"À renseigner",price:seed.price||0,packaging:seed.packaging,packagingType:seed.modifiable?"modifiable":"fixed"}],
}));
export const productFamilies=["Tous",...Array.from(new Set(products.map(product=>product.family)))];
export const suppliers=Array.from(new Set(products.flatMap(product=>product.offers.map(offer=>offer.supplier))));

export const initialOrders:Order[]=[
 {id:"CMD-2026-048",supplier:"Fournisseur électrique",date:"12 août 2026",total:1842.6,status:"Envoyée",products:8},
 {id:"CMD-2026-047",supplier:"Fournisseur climatisation",date:"8 août 2026",total:967.2,status:"Reçue",products:5},
 {id:"CMD-2026-046",supplier:"Fournisseur plomberie",date:"4 août 2026",total:431.8,status:"Brouillon",products:3},
];
export const money=(value:number)=>new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(value);
