DO $$
DECLARE
    v_org_id uuid := '191c90ad-5337-405e-9d1a-abae2ad8c70e';
    v_supplier_id uuid;
    v_category_id uuid := 'e6e1fa54-425a-4275-b538-37d1ed9dc3a5'; -- Decoración
BEGIN
    -- Insert or get supplier
    SELECT id INTO v_supplier_id FROM public.suppliers WHERE tax_id = '72044061-B' AND organization_id = v_org_id LIMIT 1;
    
    IF v_supplier_id IS NULL THEN
        INSERT INTO public.suppliers (organization_id, name, normalized_name, tax_id, iban, notes)
        VALUES (
            v_org_id, 
            'Guillermo Lantarón Meriel (Mr Glorious Balloons)', 
            'guillermo lantaron meriel mr glorious balloons',
            '72044061-B', 
            'ES4514650210171721544713',
            'C/ Alonso 7 5C, 39010 Santander, Cantabria. Tel: +34 649 23 44 46. Email: mrgloriousballoons@gmail.com'
        ) RETURNING id INTO v_supplier_id;
    END IF;

    -- Insert expense
    INSERT INTO public.expenses (
        organization_id,
        supplier_id,
        supplier_name,
        category_id,
        number,
        expense_date,
        concept,
        base_cents,
        tax_cents,
        total_cents,
        currency,
        status,
        notes
    ) VALUES (
        v_org_id,
        v_supplier_id,
        'Guillermo Lantarón Meriel (Mr Glorious Balloons)',
        v_category_id,
        '06762',
        '2026-07-30',
        'Animation, Mupets and Mascos, Letters and Deco for 528, Extra blower',
        331000,
        69510,
        400510,
        'EUR',
        'missing', -- Can be 'received' but maybe status should match existing
        'Invoice 06762 from Mr Glorious Balloons Ibiza'
    );
END $$;
