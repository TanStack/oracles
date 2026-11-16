---
'@tanstack/oracles': minor
---

A campaign's generated histories no longer depend on its constructed histories. The `generated` unit draws only from the property's arbitrary, so appending a constructed history, or changing one, keeps every fixed seed's generated histories, as the generator rules assume. Before, half of the generated unit's runs were constructed histories, weighted by how many there were, so appending one moved every run's draw.

This shifts each fixed seed's `generated` unit once: a fixed seed now runs other generated histories than before, and a replay line printed before this change for a `generated` unit no longer replays. Each constructed history still runs in its own unit, built from the arbitrary's sample at the campaign's seed plus its index, unchanged. Constructed histories are no longer also explored over the `generated` unit's runs; a random seed builds each one from a new sample.
