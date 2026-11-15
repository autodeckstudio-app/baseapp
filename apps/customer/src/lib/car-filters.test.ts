import {describe,it,expect} from "vitest";
import type {CarListingView} from "@autodeck/core";
import {filterCars,type CarFilters} from "./car-filters";
const cars=[{id:"safari",make:"Tata",model:"Safari",year:2023,area:"Ahmedabad",fuel:"Diesel",bodyType:"SUV",askingPrice:111100000,createdAt:"2026-10-06"},{id:"i10",make:"Hyundai",model:"Grand i10",year:2018,area:"Ahmedabad",fuel:"Petrol",bodyType:"hatchback",askingPrice:45100000,createdAt:"2026-10-05"},{id:"seltos",make:"Kia",model:"Seltos",year:2022,area:"Ahmedabad",fuel:"diesel",bodyType:"suv",askingPrice:135000000,createdAt:"2026-10-04"}] as CarListingView[];
const base:CarFilters={query:"",fuel:null,body:null,maxPrice:Infinity,sort:"new"};
describe("car filter bar",()=>{
 it("matches capitalized legacy fuel and body without editing records",()=>expect(filterCars(cars,{...base,fuel:"diesel",body:"suv"}).map(c=>c.id)).toEqual(["safari","seltos"]));
 it("combines search and fuel",()=>expect(filterCars(cars,{...base,query:"safari",fuel:"diesel"}).map(c=>c.id)).toEqual(["safari"]));
 it("uses paise budgets",()=>expect(filterCars(cars,{...base,maxPrice:50000000}).map(c=>c.id)).toEqual(["i10"]));
 it("sorts price independently of search and preserves the source array",()=>{expect(filterCars(cars,{...base,query:"Ahmedabad",sort:"low"}).map(c=>c.id)).toEqual(["i10","safari","seltos"]);expect(cars[0]!.id).toBe("safari");});
 it("returns no results for a real mismatch",()=>expect(filterCars(cars,{...base,fuel:"electric"})).toEqual([]));
});
describe("hidden or missing prices",()=>{
 const hid=[{id:"h",make:"Kia",model:"Seltos",year:2022,area:"A",fuel:"diesel",bodyType:null,createdAt:"2026-10-04"}] as unknown as CarListingView[];
 it("keeps a car whose price was not sent (live bug: list showed 0 cars)",()=>expect(filterCars(hid,base).map(c=>c.id)).toEqual(["h"]));
 it("keeps a hidden-price car under a budget filter",()=>expect(filterCars(hid,{...base,maxPrice:100}).map(c=>c.id)).toEqual(["h"]));
});
