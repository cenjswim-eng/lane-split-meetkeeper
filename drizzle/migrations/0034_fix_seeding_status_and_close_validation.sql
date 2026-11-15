DO $$ DECLARE definition text; BEGIN
SELECT pg_get_functiondef('public.save_meet_seeding(uuid,integer,integer,integer,text,boolean,numeric,jsonb,boolean)'::regprocedure) INTO definition;
definition:=replace(definition,'status=r->>''status''','status=CASE WHEN r->>''status''=''SCR'' THEN ''SCR'' ELSE ''SEEDED'' END');
definition:=replace(definition,'UPDATE public.meet_seeding_sessions SET lanes=p_lanes', 'IF p_close AND EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows) x WHERE x->>''status''<>''SCR'' GROUP BY x->>''eventId'',x->>''heat'' HAVING count(*)<3 AND (SELECT count(*) FROM jsonb_array_elements(p_rows) y WHERE y->>''eventId''=x->>''eventId'' AND y->>''status''<>''SCR'')>=3) THEN RAISE EXCEPTION ''Serie con menos de tres competidores''; END IF; UPDATE public.meet_seeding_sessions SET lanes=p_lanes');
EXECUTE definition;
SELECT pg_get_functiondef('public.guard_seeding_entry()'::regprocedure) INTO definition;
definition:=replace(definition,'Session fermee: reouvrez avant de modifier les inscriptions','Sesión cerrada: reabre antes de modificar inscripciones');
definition:=replace(definition,'IF TG_OP<>''INSERT'' AND EXISTS','IF TG_OP<>''INSERT'' AND EXISTS(SELECT 1 FROM public.meets WHERE id=mid) AND EXISTS');
EXECUTE definition;
SELECT pg_get_functiondef('public.reset_management_data(text)'::regprocedure) INTO definition;
definition:=replace(definition,'DELETE FROM public.splits WHERE owner_id = auth.uid();','DELETE FROM public.meet_seeding_sessions WHERE owner_id = auth.uid(); DELETE FROM public.splits WHERE owner_id = auth.uid();');
EXECUTE definition;
END $$;