import type {ViewStyle} from 'react-native';
import {raised} from './raised';
/** Customer panes share the approved theme with Home, services and account. */
export function glassPane(light=false):ViewStyle{return raised(light?'light':'night').card;}
