export type CompanyKey = "cpte" | "pose" | "instal" | "pac";
export type SupplierOffer = { supplier:string; supplierName:string; reference:string; brand:string; price:number; packaging:string; packagingType:"modifiable"|"fixed" };
export type Product = { id:number; name:string; family:string; subfamily:string; unit:string; kind:"simple"|"ensemble"; contents?:string[]; offers:SupplierOffer[] };
export type Order = { id:string; supplier:string; date:string; total:number; status:"Brouillon"|"Envoyée"|"Reçue"; products:number };

export const companies:{key:CompanyKey;name:string;short:string;color:string}[]=[
 {key:"cpte",name:"CPTE Conseil",short:"CPTE",color:"#2563eb"},{key:"pose",name:"HM Pose",short:"POSE",color:"#14b8a6"},
 {key:"instal",name:"HM Instal",short:"INSTAL",color:"#8b5cf6"},{key:"pac",name:"HM PAC",short:"PAC",color:"#f59e0b"},
];

type ProductSeed=[string,string,string,string,string?,string?,string?];
const productSeeds:ProductSeed[]=[
 ["DUO-500","PV Duonergy 500 Wc","Photovoltaïque","Panneaux","Duonergy","POWER DEAL"],
 ["MYL-500","PV MyLight 500 Wc","Photovoltaïque","Panneaux","MyLight","MY LIGHT"],
 ["JNL-500","PV JNL Solar 500 Wc","Photovoltaïque","Panneaux","JNL Solar","POWER DEAL"],
 ["JINK-500","PV Jinko Solar 500 Wc","Photovoltaïque","Panneaux","Jinko","POWER DEAL"],
 ["HMS1000-CAB-TRUNK","Micro-onduleur Hoymiles HMS-1000-2T + câble et trunk","Photovoltaïque","Micro-onduleurs","Hoymiles","POWR GROUP","ensemble"],
 ["DTU-PRO-S","Passerelle Hoymiles DTU-Pro-S","Photovoltaïque","Passerelles","Hoymiles","POWR GROUP"],
 ["HMS-CON","HMS terminal connecteur","Photovoltaïque","Micro-onduleurs","Hoymiles","POWR GROUP"],
 ["HMS-BOU","HMS bouchon d’étanchéité","Photovoltaïque","Micro-onduleurs","Hoymiles","POWR GROUP"],
 ["COF-AC4M+P","Coffret AC4 mono avec pinces Hoymiles","Photovoltaïque","Coffrets / protections","Hoymiles","POWR GROUP","coffret"],
 ["COF-AC6M+P","Coffret AC6 mono avec pinces Hoymiles","Photovoltaïque","Coffrets / protections","Hoymiles","POWR GROUP","coffret"],
 ["COF-AC9T+P","Coffret AC9 tri avec pinces Hoymiles","Photovoltaïque","Coffrets / protections","Hoymiles","POWR GROUP","coffret"],
 ["COF-AC3","Coffret AC3 mono","Photovoltaïque","Coffrets / protections","","POWR GROUP","coffret"],
 ["COF-AC6","Coffret AC6 mono","Photovoltaïque","Coffrets / protections","","POWR GROUP","coffret"],
 ["COF-AC9T","Coffret AC9 tri","Photovoltaïque","Coffrets / protections","","POWR GROUP","coffret"],
 ["COF-AC9M+P","Coffret AC9 mono avec pinces Hoymiles","Photovoltaïque","Coffrets / protections","Hoymiles","POWR GROUP","coffret"],
 ["COF-NFC-6M","Coffret normes NFC 15-100 6K mono","Photovoltaïque","Coffrets / protections","","POWR GROUP","coffret"],
 ["COF-NFC-10K","Coffret normes NFC 15-100 10K tri","Photovoltaïque","Coffrets / protections","","POWR GROUP","coffret"],
 ["MSB-MONO","MyLight Monophaser + batterie","Photovoltaïque","Domotique / monitoring","MyLight","MY LIGHT","ensemble"],
 ["MSB-TRI","MyLight Triphaser + batterie","Photovoltaïque","Domotique / monitoring","MyLight","MY LIGHT","ensemble"],
 ["IZY-BOX-TMR","IZY Box tuiles mécaniques rond orange","Photovoltaïque","Fixations / rails","ISY PV","IZY PV","carton"],
 ["IZY-BOX-TMC","IZY Box tuiles mécaniques croix orange","Photovoltaïque","Fixations / rails","ISY PV","IZY PV","carton"],
 ["IZY-BOX-AR","IZY Box ardoise rond bleu","Photovoltaïque","Fixations / rails","ISY PV","IZY PV","carton"],
 ["IZY-BOX-AC","IZY Box ardoise croix bleu","Photovoltaïque","Fixations / rails","ISY PV","IZY PV","carton"],
 ["IZY-BOX-TPR","IZY Box tuiles plates rond vert","Photovoltaïque","Fixations / rails","ISY PV","IZY PV","carton"],
 ["IZY-BOX-TPC","IZY Box tuiles plates croix vert","Photovoltaïque","Fixations / rails","ISY PV","IZY PV","carton"],
 ["IZY-BOX-FR","IZY Box fibrociment rond jaune","Photovoltaïque","Fixations / rails","ISY PV","IZY PV","carton"],
 ["IZY-BOX-FC","IZY Box fibrociment croix jaune","Photovoltaïque","Fixations / rails","ISY PV","IZY PV","carton"],
 ["IZY RAILS","IZY Rails 2,40 m","Photovoltaïque","Fixations / rails","ISY PV","IZY PV"],
 ["ECO-CLE","Ecojoko + clé Linky","Photovoltaïque","Domotique / monitoring","Ecojoko","","ensemble"],
 ["MG3","MG3","Photovoltaïque","Domotique / monitoring"],
 ["MG3C01RM","Compteur MG3C01RM avec 3 pinces","Photovoltaïque","Domotique / monitoring","","","ensemble"],
 ["SSC-FHE","SSC TKS 420/140 – 4 panneaux","ECS / Ballons","Ballons thermodynamiques","FHE","AUBADE / SFCP","ensemble"],
 ["ACCESS PAC COMPLET","Accessoires PAC complet","Accessoires","Accessoires PAC","","","carton-pac-complet"],
 ["ACCESS PAC","Accessoires PAC sans ballon tampon","Accessoires","Accessoires PAC","","","carton-pac"],
 ["TH-200","Thaleos Performer 3 200 L","ECS / Ballons","Ballons thermodynamiques","Thaleos","AUBADE / SFCP"],
 ["TH-240","Thaleos Performer 3 240 L","ECS / Ballons","Ballons thermodynamiques","Thaleos","AUBADE / SFCP"],
 ["THE-200","Thermor Aeromax 6 200 L","ECS / Ballons","Ballons thermodynamiques","Thermor","AUBADE / SFCP"],
 ["THE-240","Thermor Aeromax 6 240 L","ECS / Ballons","Ballons thermodynamiques","Thermor","AUBADE / SFCP"],
 ["AR-200","Ariston Nuos 200 L","ECS / Ballons","Ballons thermodynamiques","Ariston","AUBADE / SFCP"],
 ["AR-240","Ariston Nuos 240 L","ECS / Ballons","Ballons thermodynamiques","Ariston","AUBADE / SFCP"],
 ["AR-250","Ariston Nuos 250 L Wi-Fi","ECS / Ballons","Ballons thermodynamiques","Ariston","AUBADE / SFCP"],
 ["CH-240","Chaffoteaux Aquanext 240 L","ECS / Ballons","Ballons thermodynamiques","Chaffoteaux","AUBADE / SFCP"],
 ["ARSP-200","Ariston Aquanext Split Flex 200 L","ECS / Ballons","Ballons thermodynamiques","Ariston","AUBADE / SFCP"],
 ["LG-HU121-HN1600","LG Therma V HU121MRX + HN1600MC + thermostat","Pompe à chaleur","PAC air/eau","LG","NED ENERGY","ensemble"],
 ["LG-HU141-HN1600","LG Therma V HU141MRX + HN1600MC + thermostat","Pompe à chaleur","PAC air/eau","LG","NED ENERGY","ensemble"],
 ["LG-HU161-HN1600","LG Therma V HU161MRX + HN1600MC + thermostat","Pompe à chaleur","PAC air/eau","LG","NED ENERGY","ensemble"],
 ["LG-HU123-HN1600","LG Therma V HU123MRX + HN1600MC + thermostat","Pompe à chaleur","PAC air/eau","LG","NED ENERGY","ensemble"],
 ["LG-HU143-HN1600","LG Therma V HU143MRX + HN1600MC + thermostat","Pompe à chaleur","PAC air/eau","LG","NED ENERGY","ensemble"],
 ["LG-HU1163-HN1600","LG Therma V HU163MRX + HN1600MC + thermostat","Pompe à chaleur","PAC air/eau","LG","NED ENERGY","ensemble"],
 ["THAHP08-M","Thaleos Mont-Blanc 8 kW mono + thermostat","Pompe à chaleur","PAC air/eau","Thaleos","NED ENERGY","ensemble"],
 ["THAHP10-M","Thaleos Mont-Blanc 10 kW mono + thermostat","Pompe à chaleur","PAC air/eau","Thaleos","NED ENERGY","ensemble"],
 ["THAHP12-M","Thaleos Mont-Blanc 12 kW mono + thermostat","Pompe à chaleur","PAC air/eau","Thaleos","NED ENERGY","ensemble"],
 ["THAHP14-M","Thaleos Mont-Blanc 14 kW mono + thermostat","Pompe à chaleur","PAC air/eau","Thaleos","NED ENERGY","ensemble"],
 ["THAHP16-M","Thaleos Mont-Blanc 16 kW mono + thermostat","Pompe à chaleur","PAC air/eau","Thaleos","NED ENERGY","ensemble"],
 ["THAHP08-T","Thaleos Mont-Blanc 8 kW tri + thermostat","Pompe à chaleur","PAC air/eau","Thaleos","NED ENERGY","ensemble"],
 ["THAHP10-T","Thaleos Mont-Blanc 10 kW tri + thermostat","Pompe à chaleur","PAC air/eau","Thaleos","NED ENERGY","ensemble"],
 ["THAHP12-T","Thaleos Mont-Blanc 12 kW tri + thermostat","Pompe à chaleur","PAC air/eau","Thaleos","NED ENERGY","ensemble"],
 ["THAHP14-T","Thaleos Mont-Blanc 14 kW tri + thermostat","Pompe à chaleur","PAC air/eau","Thaleos","NED ENERGY","ensemble"],
 ["THAHP16-T","Thaleos Mont-Blanc 16 kW tri + thermostat","Pompe à chaleur","PAC air/eau","Thaleos","NED ENERGY","ensemble"],
 ["DD-11M","De Dietrich Alezio S 11 kW mono + thermostat","Pompe à chaleur","PAC air/eau","De Dietrich","NED ENERGY","ensemble"],
 ["DD-16M","De Dietrich Alezio S 16 kW mono + thermostat","Pompe à chaleur","PAC air/eau","De Dietrich","NED ENERGY","ensemble"],
];

const pacContents=["Roberfoot","Pot à boue","Vase d’expansion + potence","Disconnecteur","Circulateur","Coupure d’urgence","2 vannes antigel"];
const contentsFor=(tag?:string)=>tag==="coffret"?["Coffret vide","Disjoncteurs et protections selon la référence"]:tag==="carton-pac-complet"?["Ballon tampon 50 L",...pacContents]:tag==="carton-pac"?pacContents:undefined;
const packagingFor=(tag?:string)=>tag?.startsWith("carton")?"Carton complet":tag==="coffret"||tag==="ensemble"?"Ensemble complet":"Pièce";
export const products:Product[]=productSeeds.map(([reference,name,family,subfamily,brand="",supplier="",tag],index)=>({
 id:index+1,name,family,subfamily,unit:tag?.startsWith("carton")?"Carton":tag==="coffret"||tag==="ensemble"?"Ensemble":"Pièce",kind:tag?"ensemble":"simple",contents:contentsFor(tag),
 offers:[{supplier:supplier||"À définir",supplierName:name.toUpperCase(),reference,brand:brand||"À définir",price:0,packaging:packagingFor(tag),packagingType:"fixed"}],
}));
export const productFamilies=["Tous",...Array.from(new Set(products.map(product=>product.family)))];
export const suppliers=Array.from(new Set(products.flatMap(product=>product.offers.map(offer=>offer.supplier)).filter(name=>name!=="À définir")));
export const initialOrders:Order[]=[
 {id:"CMD-2026-048",supplier:"POWR GROUP",date:"12 août 2026",total:1842.6,status:"Envoyée",products:8},
 {id:"CMD-2026-047",supplier:"NED ENERGY",date:"8 août 2026",total:967.2,status:"Reçue",products:5},
 {id:"CMD-2026-046",supplier:"IZY PV",date:"4 août 2026",total:431.8,status:"Brouillon",products:3},
 {id:"CMD-2026-045",supplier:"AUBADE / SFCP",date:"29 juillet 2026",total:2290.4,status:"Reçue",products:11},
];
export const money=(value:number)=>new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(value);
