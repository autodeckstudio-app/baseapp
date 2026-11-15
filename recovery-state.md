# Connected-visit source recovery

This working tree was recovered from the verified pushed predecessor 9339d7ffab982f4a62bbd198e547b05dafd03c10 and exact subsequent application source mutations. It is not the original lost git object 3ccba148 and must not be described as that commit.

Recovery custody v7 is preserved separately, unchanged. This current tree adds one explicit reconstruction: pnpm-lock.yaml now includes the exact Leaflet 1.9.4 and @types/leaflet 1.9.21 direct versions. @types/geojson 7946.0.16 is newly resolved for that type dependency. All prior lockfile importers, package resolutions and snapshots are unchanged semantically. A frozen installation passes. The lost lockfile itself was not recovered.

No release, deployment, provider activation or production money operation is implied by recovery or local testing. Subsequent fixes must be recorded separately from recovered source.
