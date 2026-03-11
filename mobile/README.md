mobile/src/
├── screens/
│   ├── Auth/
│   │   ├── LoginScreen.js
│   │   ├── RegisterScreen.js
│   │   └── OnboardingScreen.js
│   ├── Customer/
│   │   ├── HomeScreen.js
│   │   ├── ServiceSelectionScreen.js
│   │   ├── RequestRideScreen.js
│   │   ├── RequestDeliveryScreen.js
│   │   ├── TrackingScreen.js
│   │   └── HistoryScreen.js
│   ├── Driver/
│   │   ├── DriverDashboardScreen.js
│   │   ├── IncomingRideScreen.js
│   │   ├── ActiveRideScreen.js
│   │   └── EarningsScreen.js
│   ├── Partner/
│   │   ├── PartnerDashboardScreen.js
│   │   ├── IncomingDeliveryScreen.js
│   │   ├── ActiveDeliveryScreen.js
│   │   └── ProofOfDeliveryScreen.js
│   └── Shared/
│       ├── ProfileScreen.js
│       ├── PaymentMethodsScreen.js
│       └── SupportScreen.js
├── components/
│   ├── Map/
│   │   ├── MapView.js
│   │   ├── LocationPicker.js
│   │   ├── DriverMarker.js
│   │   └── RoutePolyline.js
│   ├── Cards/
│   │   ├── RideCard.js
│   │   ├── DeliveryCard.js
│   │   └── DriverCard.js
│   ├── Inputs/
│   │   ├── AddressInput.js
│   │   ├── PhoneInput.js
│   │   └── RatingInput.js
│   └── Common/
│       ├── Button.js
│       ├── Input.js
│       └── Loading.js
├── navigation/
│   ├── AppNavigator.js
│   ├── AuthNavigator.js
│   ├── CustomerNavigator.js
│   ├── DriverNavigator.js
│   └── PartnerNavigator.js
├── context/
│   ├── AuthContext.js
│   ├── LocationContext.js
│   ├── RideContext.js
│   └── DeliveryContext.js
├── services/
│   ├── api.js                  ✅ Already created
│   └── socket.js               ✅ Already created
├── utils/
│   ├── helpers.js
│   ├── permissions.js
│   └── constants.js
└── theme/
    ├── colors.js
    └── spacing.js