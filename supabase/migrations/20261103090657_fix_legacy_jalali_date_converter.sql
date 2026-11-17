
create or replace function public.legacy_jalali_to_gregorian(p_text text)
returns date language plpgsql immutable set search_path = '' as $$
declare jy integer; jm integer; jd integer; days bigint; gy bigint; gd integer; gm integer; dim integer; leap boolean;
begin
  if p_text is null or p_text !~ '^[0-9]{4}/[0-9]{1,2}/[0-9]{1,2}$' then raise exception 'Invalid Jalali date: %',p_text; end if;
  jy:=split_part(p_text,'/',1)::integer; jm:=split_part(p_text,'/',2)::integer; jd:=split_part(p_text,'/',3)::integer;
  if jm<1 or jm>12 or jd<1 or jd>31 then raise exception 'Invalid Jalali date: %',p_text; end if;
  jy:=jy+1595;
  days:=-355668+(365::bigint*jy)+((jy/33)*8)+(((jy%33)+3)/4)+jd+
    case when jm<7 then ((jm-1)*31) else (((jm-7)*30)+186) end;
  gy:=400*(days/146097); days:=days%146097;
  if days>36524 then
    days:=days-1; gy:=gy+100*(days/36524); days:=days%36524;
    if days>=365 then days:=days+1; end if;
  end if;
  gy:=gy+4*(days/1461); days:=days%1461;
  if days>365 then gy:=gy+((days-1)/365); days:=(days-1)%365; end if;
  gd:=(days+1)::integer;
  leap:=((gy%4=0) and (gy%100<>0)) or (gy%400=0);
  gm:=1;
  loop
    dim:=case gm when 1 then 31 when 2 then case when leap then 29 else 28 end when 3 then 31 when 4 then 30 when 5 then 31 when 6 then 30 when 7 then 31 when 8 then 31 when 9 then 30 when 10 then 31 when 11 then 30 else 31 end;
    exit when gd<=dim;
    gd:=gd-dim;
    gm:=gm+1;
    if gm>12 then raise exception 'Jalali conversion overflow: %',p_text; end if;
  end loop;
  return make_date(gy::integer,gm,gd);
end; $$;

