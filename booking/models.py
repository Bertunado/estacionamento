from django.db import models
from parking.models import ParkingSpot
from django.contrib.auth import get_user_model
User = get_user_model()

class Booking(models.Model):
    spot = models.ForeignKey(ParkingSpot, on_delete=models.CASCADE, related_name="bookings")
    renter = models.ForeignKey(User, on_delete=models.CASCADE, related_name="bookings")
    start  = models.DateTimeField()
    end    = models.DateTimeField()
    status = models.CharField(max_length=20, default="pending")  # pending, active, done, cancelled

class Favorite(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="favorites")
    spot = models.ForeignKey(ParkingSpot, on_delete=models.CASCADE, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)