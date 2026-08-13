"use client";
import {BarChart3,Box,ClipboardList,ClipboardPlus,PackagePlus,Settings,Users,X} from "lucide-react";
export const navItems=[
 {id:"dashboard",label:"Tableau de bord",icon:BarChart3},{id:"new-order",label:"Nouvelle commande",icon:PackagePlus},
 {id:"purchase-requests",label:"Demandes d’achat",icon:ClipboardPlus},{id:"orders",label:"Commandes",icon:ClipboardList},{id:"products",label:"Produits",icon:Box},
 {id:"users",label:"Utilisateurs",icon:Users},{id:"settings",label:"Paramètres",icon:Settings},
] as const;
export type ScreenId=typeof navItems[number]["id"];
export function Sidebar({active,onChange,open,onClose}:{active:ScreenId;onChange:(id:ScreenId)=>void;open:boolean;onClose:()=>void}){
 return <><div className={"mobile-overlay "+(open?"visible":"")} onClick={onClose}/><aside className={"sidebar "+(open?"open":"")}>
  <div className="brand"><div className="brand-mark">HM</div><div><strong>HM GROUP</strong><small>Achats filiales</small></div><button className="close-sidebar" onClick={onClose}><X size={20}/></button></div>
  <nav><p className="nav-eyebrow">GESTION</p>{navItems.slice(0,5).map(({id,label,icon:Icon})=><button key={id} className={active===id?"active":""} onClick={()=>{onChange(id);onClose()}}><Icon size={19}/><span>{label}</span></button>)}
  <p className="nav-eyebrow second">ADMINISTRATION</p>{navItems.slice(5).map(({id,label,icon:Icon})=><button key={id} className={active===id?"active":""} onClick={()=>{onChange(id);onClose()}}><Icon size={19}/><span>{label}</span></button>)}</nav>
  <div className="sidebar-user"><div className="avatar">YD</div><div><strong>Administrateur HM</strong><small>Administrateur</small></div><span className="online-dot"/></div>
 </aside></>
}
export function MobileNav({active,onChange}:{active:ScreenId;onChange:(id:ScreenId)=>void}){return <nav className="mobile-nav">{navItems.slice(0,5).map(({id,label,icon:Icon})=><button key={id} className={active===id?"active":""} onClick={()=>onChange(id)}><Icon size={20}/><span>{label==="Nouvelle commande"?"Commander":label==="Demandes d’achat"?"Demandes":label==="Tableau de bord"?"Accueil":label}</span></button>)}</nav>}
