import { openDB } from 'https://cdn.jsdelivr.net/npm/idb@8/+esm';

const DB_NAME = 'QuizyDB';
const DB_VERSION = 1;
const STORE_NAME = 'sets';

async function getDB() {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        }
    });
}

export async function getLocalSets() {
    const db = await getDB();
    return db.getAll(STORE_NAME);
}

export async function getLocalSet(id) {
    const db = await getDB();
    return db.get(STORE_NAME, Number(id));
}

export async function saveLocalSets(sets) {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    for (const set of sets) {
        tx.store.put(set);
    }
    await tx.done;
}

export async function saveLocalSet(set) {
    const db = await getDB();
    await db.put(STORE_NAME, set);
}

export async function deleteLocalSet(id) {
    const db = await getDB();
    await db.delete(STORE_NAME, Number(id));
}

export async function syncSets(supabase, userId) {
    const localSets = await getLocalSets();
    let maxUpdatedAt = '1970-01-01T00:00:00.000Z';
    
    for (const set of localSets) {
        if (set.updated_at && set.updated_at > maxUpdatedAt) {
            maxUpdatedAt = set.updated_at;
        }
    }

    if (navigator.onLine) {
        try {
            const { data: remoteSets, error } = await supabase
                .from('Sets')
                .select('id, updated_at')
                .eq('user_id', userId);

            if (!error && remoteSets) {
                const remoteIds = new Set(remoteSets.map(s => s.id));
                for (const localSet of localSets) {
                    if (!remoteIds.has(localSet.id)) {
                        await deleteLocalSet(localSet.id);
                    }
                }

                const { data: updatedSets, error: updateError } = await supabase
                    .from('Sets')
                    .select('id, title, description, folder, type, card_count, updated_at, created_at, user_id, lang_col1, lang_col2')
                    .eq('user_id', userId)
                    .gt('updated_at', maxUpdatedAt);

                if (!updateError && updatedSets && updatedSets.length > 0) {
                    await saveLocalSets(updatedSets);
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    const finalSets = await getLocalSets();
    return finalSets.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
}

export async function getSetWithCards(supabase, setId, userId) {
    let localSet = await getLocalSet(setId);
    
    if (navigator.onLine) {
        try {
            if (localSet && localSet.cards) {
                const { data: setMeta, error: metaErr } = await supabase
                    .from('Sets')
                    .select('updated_at')
                    .eq('id', setId)
                    .single();

                if (!metaErr && setMeta && (!localSet.updated_at || setMeta.updated_at > localSet.updated_at)) {
                    const { data: fullSet, error } = await supabase
                        .from('Sets')
                        .select('*')
                        .eq('id', setId)
                        .eq('user_id', userId)
                        .single();
                    if (!error && fullSet) {
                        await saveLocalSet(fullSet);
                        localSet = fullSet;
                    }
                }
            } else {
                const { data: fullSet, error } = await supabase
                    .from('Sets')
                    .select('*')
                    .eq('id', setId)
                    .eq('user_id', userId)
                    .single();
                if (!error && fullSet) {
                    await saveLocalSet(fullSet);
                    localSet = fullSet;
                }
            }
        } catch (e) {
            console.error(e);
        }
    }
    
    return localSet;
}

export async function syncSetToRemote(supabase, dbPayload, setId = null) {
    if (dbPayload.cards && Array.isArray(dbPayload.cards)) {
        dbPayload.cards.forEach(card => {
            if (card.starred === false || card.starred === null || card.starred === undefined) {
                delete card.starred;
            }
        });
    }

    if (setId) {
        const { error: updateError } = await supabase.from('Sets').update(dbPayload).eq('id', setId);
        if (updateError) throw updateError;
        
        dbPayload.id = setId;
        const existingSet = await getLocalSet(setId);
        const mergedPayload = existingSet ? { ...existingSet, ...dbPayload } : dbPayload;
        await saveLocalSet(mergedPayload);
    } else {
        const { data, error: insertError } = await supabase.from('Sets').insert([dbPayload]).select('id, created_at, updated_at').single();
        if (insertError) throw insertError;
        
        dbPayload.id = data.id;
        dbPayload.created_at = data.created_at;
        dbPayload.updated_at = data.updated_at;
        await saveLocalSet(dbPayload);
    }
}   