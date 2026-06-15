export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const uuid = url.searchParams.get("uuid");

    if (!uuid) {
      return new Response(JSON.stringify({ error: "Missing player UUID" }), { status: 400 });
    }

    const cacheKey = `sb-profile-${uuid}`;
    const cachedData = await env.SKYBLOCK_CACHE.get(cacheKey);
    
    if (cachedData) {
      return new Response(cachedData, {
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "X-Cache": "HIT"
        }
      });
    }

    const hypixelUrl = `https://api.hypixel.net/v2/skyblock/profiles?uuid=${uuid}`;
    
    try {
      const response = await fetch(hypixelUrl, {
        headers: { 
          "API-Key": env.HYPIXEL_API_KEY,
          "Accept": "application/json"
        }
      });

      const data = await response.json();
      if (!data.success || !data.profiles) {
        return new Response(JSON.stringify({ error: "No profiles found or API error" }), { status: 404 });
      }

      const activeProfile = data.profiles.find(p => p.selected === true) || data.profiles[0];
      const memberData = activeProfile.members[uuid];

      const structuredResult = {
        profileName: activeProfile.cute_name,
        gameMode: activeProfile.game_mode || "Normal",
        skyblockLevel: (memberData.leveling?.experience ?? 0) / 100, 
        purse: memberData.currencies?.purse ?? 0,
        bank: activeProfile.banking?.balance ?? 0,
        petsCount: memberData.pets_data?.pets?.length ?? 0,
        hasInventoryData: !!memberData.inventory?.inv_contents,
        hasArmorData: !!memberData.inventory?.armor_contents
      };

      const finalResponseString = JSON.stringify(structuredResult);
      await env.SKYBLOCK_CACHE.put(cacheKey, finalResponseString, { expirationTtl: 300 });

      return new Response(finalResponseString, {
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "X-Cache": "MISS"
        }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }
};
