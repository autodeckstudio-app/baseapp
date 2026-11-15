import type {ImageSourcePropType} from "react-native";
import logo0 from "../../assets/imagery/brands/carpro-logo.png";
import logo1 from "../../assets/imagery/brands/koch-chemie-logo.png";
import logo2 from "../../assets/imagery/brands/avery-dennison-logo.png";
import logo3 from "../../assets/imagery/brands/rodim-logo.png";
import logo4 from '../../assets/imagery/brands/gswf-logo.webp';
import logo5 from '../../assets/imagery/brands/nar-logo.png';
import logo6 from '../../assets/imagery/brands/avvyx-logo.png';
import logo7 from "../../assets/brand/icon-512.png";
import logo8 from '../../assets/imagery/brands/xpel-logo.png';
import logo9 from '../../assets/imagery/brands/3m-logo.jpg';
import logo10 from '../../assets/imagery/brands/llumar-logo.png';
import logo11 from '../../assets/imagery/brands/garware-logo.png';
import logo12 from '../../assets/imagery/brands/fireball-logo.png';
import logo13 from '../../assets/imagery/brands/kovalent-logo.png';
import logo14 from '../../assets/imagery/brands/gtechniq-logo.png';
/** Official brand marks, contained without recolouring, distortion or crop. */
export const BRAND_LOGOS: Record<string, {src: ImageSourcePropType; background: string}> = {
  Gtechniq: {src:logo14,background:'#15171B'},
  CarPro: {src:logo0,background:"#15171B"},
  "Koch-Chemie": {src:logo1,background:"#FFFFFF"},
  "Avery Dennison": {src:logo2,background:"#FFFFFF"},
  Rodim: {src:logo3,background:"#FFFFFF"},
  GSWF:{src:logo4,background:'#15171B'},
  NAR:{src:logo5,background:'#15171B'},
  AVVYX:{src:logo6,background:'#15171B'},
  "AutoDeck Care": {src: logo7, background: "#FFFFFF"},
  XPEL: {src: logo8, background: '#FFFFFF'},
  '3M': {src: logo9, background: '#FFFFFF'},
  LLumar: {src: logo10, background: '#FFFFFF'},
  Garware: {src: logo11, background: '#15171B'},
  Fireball: {src: logo12, background: '#FFFFFF'},
  Kovalent: {src: logo13, background: '#15171B'},
};
