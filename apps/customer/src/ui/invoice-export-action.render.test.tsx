vi.mock("./NavIcon",()=>({NavIcon:(p:Record<string,unknown>)=>React.createElement("NavIcon",p)}));
import React from "react";
import { act, create } from "react-test-renderer";
// @ts-expect-error workspace has no react-dom declarations
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "node:fs";
import { beforeEach, expect, it, vi } from "vitest";
import type * as Native from "react-native";
import { StyleSheet } from "react-native";
const h=vi.hoisted(()=>({call:vi.fn()}));
vi.mock("../lib/invoice-export",()=>({exportInvoiceCopy:h.call}));
vi.mock("react-native",async original=>{const m=await original<typeof Native>();return{...m,Platform:{...m.Platform,OS:"android"}}});
import { InvoiceExportAction } from "./InvoiceExportAction";
import { Button } from "./kit";
beforeEach(()=>{h.call.mockReset();h.call.mockResolvedValue(undefined)});
it("native action is present with private-save wording and duplicate press protection",async()=>{let resolve!:()=>void;h.call.mockImplementation(()=>new Promise<void>(r=>{resolve=r}));let tree!:ReturnType<typeof create>;await act(async()=>{tree=create(<InvoiceExportAction html="exact existing invoice"/>)});const button=tree.root.findByType(Button);expect(button.props.label).toBe("Save PDF copy");await act(async()=>{button.props.onPress();button.props.onPress()});expect(h.call).toHaveBeenCalledTimes(1);expect(tree.root.findByType(Button).props.disabled).toBe(true);await act(async()=>resolve());expect(tree.root.findByType(Button).props.disabled).toBe(false);await act(async()=>tree.unmount());});
it("error is visible and old route/account cannot share after unmount",async()=>{let current!:()=>boolean;h.call.mockImplementation(async(_html:string,c:()=>boolean)=>{current=c;throw Error("native failure")});let tree!:ReturnType<typeof create>;await act(async()=>{tree=create(<InvoiceExportAction html="exact invoice"/>)});await act(async()=>tree.root.findByType(Button).props.onPress());expect(JSON.stringify(tree.toJSON())).toContain("could not be confirmed");expect(current()).toBe(true);await act(async()=>tree.unmount());expect(current()).toBe(false)});
it("renders the actual native export action at390px for pixel inspection",()=>{const content=renderToStaticMarkup(<div style={{padding:20,background:"#202423",color:"#f3f1eb",minHeight:300}}><h2>Invoice copy</h2><p>Synthetic visual fixture only</p><InvoiceExportAction html="synthetic invoice"/></div>);writeFileSync('/tmp/autodeck-native-invoice-export14.html',`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#202423;font-family:Arial}${(StyleSheet as unknown as {getSheet:()=>{textContent:string}}).getSheet().textContent}</style>${content}`)});
