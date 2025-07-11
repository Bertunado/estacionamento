import mercadopago
import os
from booking.models import Booking

sdk = mercadopago.SDK(os.getenv("MP_ACCESS_TOKEN"))

def create_preference(booking: Booking):
    preference_data = {
        "items": [{
            "title": f"Vaga {booking.spot.title}",
            "quantity": 1,
            "unit_price": float(booking.total_price),
            "currency_id": "BRL",
        }],
        "payer": {
            "email": booking.renter.email,
        },
        "notification_url": "https://seusite.com/payments/webhook/",
        "external_reference": str(booking.id),
    }
    pref = sdk.preference().create(preference_data)
    return pref["response"]["init_point"]