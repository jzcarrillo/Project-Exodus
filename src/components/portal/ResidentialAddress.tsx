'use client';
import {useEffect,useMemo,useState} from 'react';
import {Combobox,ComboboxInput,ComboboxContent,ComboboxList,ComboboxItem,ComboboxEmpty} from '@/components/ui/combobox';
import locations from '@/lib/ph-addresses.json';
type Option={code:string;name:string};
type Address=Record<string,string>;

function itemLabel(item: Option){return item.name;}
function itemEqual(item: Option,selected: Option){return item.code===selected.code;}
function renderItem(item: Option){return <ComboboxItem key={item.code} value={item}>{item.name}</ComboboxItem>;}

export default function ResidentialAddress({data,onChange,required=true}:{data:Address;onChange:(data:Address)=>void;required?:boolean}){
  const province=locations.provinces.find(p=>p.code===data.provinceCode)||locations.provinces.find(p=>p.name===data.province)||null;
  const cities=useMemo(()=>locations.cities.filter(c=>c.provinceCode===province?.code),[province?.code]);
  const city=cities.find(c=>c.code===data.cityCode)||cities.find(c=>c.name===data.city)||null;
  const [loaded,setLoaded]=useState<{province:string;items:Record<string,Option[]>}|null>(null);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    setError('');
    if(!province)return;
    const controller=new AbortController();
    fetch('/addresses/'+province.code+'.json',{signal:controller.signal})
      .then(r=>{if(!r.ok)throw new Error('Could not load barangays.');return r.json()})
      .then((items: Record<string,Option[]>)=>{if(!controller.signal.aborted)setLoaded({province:province!.code,items});})
      .catch(e=>{if(e.name!=='AbortError')setError('Could not load barangays. Please try again.');});
    return()=>controller.abort();
  },[province?.code,retry]);
  const barangays=loaded?.province===province?.code&&city?loaded.items[city.code]||[]:[];
  const barangay=barangays.find(b=>b.code===data.barangayCode)||barangays.find(b=>b.name===data.barangay)||null;
  const isLoading=!!province&&loaded?.province!==province.code&&!error;
  const suffix=required?' *':'';
  return (
    <>
      <div className="fields-grid address-fields">
        <div className="field full-width">
          <label htmlFor="street">House / unit, building, street{suffix}</label>
          <input id="street" autoComplete="address-line1" required={required} value={data.street||''} onChange={e=>onChange({...data,street:e.target.value})} placeholder="House no., street, subdivision"/>
        </div>
        <AddressPicker id="province" label={'Province / Metro Manila'+suffix} placeholder="Search province or Metro Manila" items={locations.provinces} value={province} onChange={p=>onChange({...data,province:p?.name||'',provinceCode:p?.code||'',city:'',cityCode:'',barangay:'',barangayCode:'',postalCode:''})}/>
        <AddressPicker id="city" label={'City / municipality'+suffix} placeholder={province?'Search city or municipality':'Select a province first'} disabled={!province} items={cities} value={city} onChange={c=>onChange({...data,city:c?.name||'',cityCode:c?.code||'',barangay:'',barangayCode:'',postalCode:''})}/>
        <AddressPicker id="barangay" label={'Barangay'+suffix} placeholder={!city?'Select a city / municipality first':isLoading?'Loading barangays…':'Search barangay'} disabled={!city||isLoading||!!error} items={barangays} value={barangay} onChange={b=>onChange({...data,barangay:b?.name||'',barangayCode:b?.code||''})}/>
        <div className="field">
          <label htmlFor="postalCode">Postal code{suffix}</label>
          <input id="postalCode" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="postal-code" required={required} placeholder="4-digit postal code" value={data.postalCode||''} onChange={e=>onChange({...data,postalCode:e.target.value.replace(/\D/g,'')})}/>
        </div>
        {error&&<div className="error-box" role="alert">{error}<button type="button" onClick={()=>setRetry(x=>x+1)}>Retry</button></div>}
        <p className="address-hint">Select your province, then city or municipality, and barangay. For NCR addresses, choose Metro Manila (NCR).</p>
      </div>
    </>
  );
}

function AddressPicker({id,label,placeholder,items,value,onChange,disabled=false}:{id:string;label:string;placeholder:string;items:Option[];value:Option|null;onChange:(value:Option|null)=>void;disabled?:boolean}){
  return (
    <div className="field address-picker">
      <label htmlFor={id}>{label}</label>
      <Combobox items={items} value={value} onValueChange={onChange} itemToStringLabel={itemLabel} isItemEqualToValue={itemEqual} disabled={disabled}>
        <ComboboxInput id={id} aria-label={label.replace(' *','')} placeholder={placeholder} disabled={disabled} showClear={!!value} autoComplete="off"/>
        <ComboboxContent className="address-options">
          <ComboboxEmpty>No matching location.</ComboboxEmpty>
          <ComboboxList>{renderItem}</ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}
