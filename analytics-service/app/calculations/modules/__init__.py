"""
Importing this package registers every module's rules.

A new module becomes live by adding its file here and adding its name to
MODULES. The engine then finds its rules through the registry and never
needs to know the module exists.
"""

from app.calculations.modules import carbon, noise, resource, waste, water

MODULES = (noise, water, carbon, resource, waste)

__all__ = ["MODULES", "carbon", "noise", "resource", "waste", "water"]
