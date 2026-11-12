# Scoped payment backend release, 12 November 2026

Owner approved nearest-rupee half-up rounding and scoped backend release. Customer web, native applications, Admin, Studio and website are not published by this release.

Ten source-only function updates succeeded. Existing runtime, secret bindings, service environment and IAM were preserved. Legacy advance and separate gift/wash/transport-benefit/quote activation gates remain off. Old refund handlers were not changed. settleManualRefund still has no invoker binding.

Source bundles for webhook and expiry preserve older deployed menu, bay, legacy advance rounding, membership-refund query and invoice issuer behavior. Strict webhook amount/currency checks and consult approval binding checks are preserved.

Qualification: 1472 backend unit tests, 1064 Customer unit tests, 340 render tests. Demo-emulator artifact flow checked 2109000 total, 421800 advance, 1687200 settlement and one reconciled invoice. No production records or real provider calls. Real provider settlement acceptance is not claimed.

## Deployed revisions and artifact hashes

- adminCancelBooking: `admincancelbooking-00017-gur`; bundle SHA-256 `6a7fa099e89fb722f967ac2ebd38bdf5db8b5abfe7d6cafd3c89386cdf219cff`; archive SHA-256 `1705c8dff7289cf5543908b33838926e96aab95d2d0001a9a626bc53802a2ab1`.
- expirePendingBookingsScheduled: `expirependingbookingsscheduled-00004-vap`; bundle SHA-256 `5e160daa414baee28f80d7a4a7557c34e843913b99a9a9c3a3fb4dcbcd305382`; archive SHA-256 `1f9e24a51fbdac8ff69b46826977b63e208e2126a6eaad0bca17bc54eceee716`.
- razorpayWebhook: `razorpaywebhook-00025-lis`; bundle SHA-256 `eb8c5de25780c2c3d525ddded0d8948c36e3a4728416c36be831bd44685abefe`; archive SHA-256 `6e356f7e95b630348be1d4b6b2b4389a2bbb8b436d33b75d64467fa87a0d7593`.
- createBooking: `createbooking-00029-ney`; bundle SHA-256 `16f4e3d1fdb7edc296945b9b6a8d0bd9ac0f580cb2ef3557b62b7bcf4e1d12b5`; archive SHA-256 `7ad9ae93cf1cf3c599a2c489e2b230c8ece42fa8a85194c1013560d6b7ee08fd`.
- confirmManualPayment: `confirmmanualpayment-00017-zaj`; bundle SHA-256 `70693097b76ea453c231d035a32f50462e7e8e46922b5d5f741aa9dab734106a`; archive SHA-256 `b452f4b22ef7b946f5ece1ac1b305835cdaed6962644a47a13127825f32e2ce6`.
- requestAdvancePayment: `requestadvancepayment-00010-tot`; bundle SHA-256 `dbfee970867cda75bc48ef272f56811c25ff79e07f2e88a72475be7f4870ddf5`; archive SHA-256 `83556ddf9726666c4e4f27c7966901db6eac2af61b4930e588667059d9345e8e`.
- resolveNoShow: `resolvenoshow-00004-dux`; bundle SHA-256 `3d4d50d762a5f1d8dd4695065febc45b4e22d076a13cc91ce8e5a61518974af3`; archive SHA-256 `5caa6e75cc4ecceb4fe45b8d4e752a6b735ef2c764d96f8973309b69495a9605`.
- cancelBooking: `cancelbooking-00028-jus`; bundle SHA-256 `2d0f83196f7230f2462250a2093bde2e810765cec3e930869d721cebdcdd5369`; archive SHA-256 `6e029246e07bee1f3a5753a32881e1a6031345bba509fe36f29b01acf948c255`.
- initiatePayment: `initiatepayment-00016-juz`; bundle SHA-256 `6ec83dfa457a30d7f4e40e1efcb149ffe9e767e481a065f06044cb8593000227`; archive SHA-256 `de658d7f5f9e270d7bbfc48724d49612a8af7c324c1e7e0318fcf1bde23d8842`.
- recordManualPayment: `recordmanualpayment-00019-ric`; bundle SHA-256 `8d70881261e57c357f5e0ce36d29e6f59ad1a2d48fa8b0750818a83564e2d414`; archive SHA-256 `640f8181c2dea522ba2f2b3561fa6317189eb62690dcf0f1991f8a64faa04494`.
