import { it, expect, vi } from "vitest";
// @ts-expect-error workspace has no react-dom declarations
import { renderToStaticMarkup } from "react-dom/server";
import { act, create } from "react-test-renderer";
import { Pressable } from "react-native";
import { Button, Row } from "./kit";
import { IconAction } from "./IconAction";
import { ListRow } from "./ListRow";

it("familiar contextual action is icon-only, named and has a 48px clear target", () => {
 const h=renderToStaticMarkup(<Button icon="call" label="Call the studio" onPress={()=>{}}/>);
 expect(h).toContain('aria-label="Call the studio"');expect(h).toContain('<svg');expect(h).not.toContain('>Call the studio<');expect(h).toContain('width:48px');expect(h).toContain('background-color:rgba(0,0,0,0.00)');
});
it("money, consent, warning and destructive confirmation words remain visible", () => {
 for(const label of ["Pay ₹500", "Review booking terms", "Confirm service booking", "Yes, remove"]){const h=renderToStaticMarkup(<Button label={label}/>);expect(h).toContain(`>${label}<`);}
});
it("icon actions retain event, disabled and busy semantics", async () => {
 const click=vi.fn();let r:any;await act(async()=>{r=create(<Button icon="download" label="Download PDF" onPress={click}/>)});
 const p=r.root.findByType(Pressable);expect(p.props.accessibilityLabel).toBe("Download PDF");await act(async()=>p.props.onPress());expect(click).toHaveBeenCalledOnce();
 await act(async()=>r.update(<Button icon="download" label="Opening invoice copy" busy/>));expect(r.root.findByType(Pressable).props.disabled).toBe(true);expect(r.root.findByType(Pressable).props.accessibilityState.busy).toBe(true);await act(async()=>r.unmount());
});
it("edit uses a line icon without an outer badge; row titles remain readable", () => {
 const h=renderToStaticMarkup(<IconAction kind="edit" label="Edit name" onPress={()=>{}}/>);expect(h).toContain('aria-label="Edit name"');expect(h).toContain('<svg');expect(h).toContain('background-color:rgba(0,0,0,0.00)');expect(h).not.toContain('✎');
 const row=renderToStaticMarkup(<Row title="Help & contact" onPress={()=>{}}/>);expect(row).toContain('Help &amp; contact');expect(row).toContain('<svg');
 const list=renderToStaticMarkup(<ListRow icon="chat" title="Your quotes" detail="Review work and prices" action="Open" onPress={()=>{}}/>);expect(list).toContain('aria-label="Your quotes"');expect(list).not.toContain('>Open<');expect(list).toContain('Review work and prices');
});
