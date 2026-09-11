import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  LocateFixed,
  CheckCircle2,
} from "lucide-react";

import { demoProject } from "../data/dummyData";

export default function Location() {
  const { locationData } = demoProject;

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="mb-7">
        <p className="mb-1 text-sm font-medium text-emerald-700">
          Assessment Setup
        </p>

        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Location & GIS
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Select the project location and review the environmental information
          available for the selected area.
        </p>
      </div>

      {/* Progress */}
      <div className="mb-6 border border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
              ✓
            </div>

            <span className="text-sm text-slate-500">
              Project Details
            </span>
          </div>

          <div className="mx-4 h-px flex-1 bg-emerald-200" />

          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-700 text-xs font-semibold text-white">
              2
            </div>

            <span className="text-sm font-medium text-slate-900">
              Location & GIS
            </span>
          </div>

          <div className="mx-4 h-px flex-1 bg-slate-200" />

          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-xs font-medium text-slate-400">
              3
            </div>

            <span className="text-sm text-slate-400">
              Environmental Inputs
            </span>
          </div>
        </div>
      </div>

      {/* Location input */}
      <section className="mb-6 border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center bg-emerald-50 text-emerald-700">
              <MapPin size={18} />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Project Location
              </h2>

              <p className="mt-0.5 text-xs text-slate-500">
                Enter coordinates or select the project location on the map.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 p-6">
          <div className="col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Location
            </label>

            <input
              type="text"
              value={demoProject.location}
              readOnly
              className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none"
            />
          </div>

          <div className="flex items-end">
            <button className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50">
              <LocateFixed size={16} />
              Use Current Location
            </button>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Latitude
            </label>

            <input
              type="text"
              value={locationData.latitude}
              readOnly
              className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Longitude
            </label>

            <input
              type="text"
              value={locationData.longitude}
              readOnly
              className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Elevation
            </label>

            <input
              type="text"
              value={locationData.elevation}
              readOnly
              className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none"
            />
          </div>
        </div>
      </section>

      {/* Map */}
      <section className="mb-6 border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Site Map
            </h2>

            <p className="mt-0.5 text-xs text-slate-500">
              Project location and surrounding area
            </p>
          </div>

          <span className="flex items-center gap-1.5 text-xs text-emerald-700">
            <CheckCircle2 size={14} />
            Location selected
          </span>
        </div>

        <div className="relative h-95 overflow-hidden bg-slate-100">
          {/* Temporary map placeholder */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-emerald-700 shadow-sm">
                <MapPin size={24} />
              </div>

              <p className="text-sm font-medium text-slate-700">
                Solapur, Maharashtra
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {locationData.latitude}, {locationData.longitude}
              </p>

              <p className="mt-3 text-[11px] text-slate-400">
                Interactive GIS map will be connected here
              </p>
            </div>
          </div>

          {/* Coordinates label */}
          <div className="absolute bottom-4 left-4 border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
            <span className="font-medium">Coordinates:</span>{" "}
            {locationData.latitude}, {locationData.longitude}
          </div>
        </div>
      </section>

      {/* GIS information */}
      <section className="mb-6 border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Environmental Location Data
          </h2>

          <p className="mt-0.5 text-xs text-slate-500">
            Information retrieved for the selected project location.
          </p>
        </div>

        <div className="grid grid-cols-3 divide-x divide-slate-200">
          <div className="p-5">
            <p className="text-xs text-slate-500">Air Quality Index</p>

            <p className="mt-1 text-xl font-semibold text-slate-800">
              {locationData.aqi}
            </p>

            <p className="mt-1 text-xs text-amber-700">
              Moderate
            </p>
          </div>

          <div className="p-5">
            <p className="text-xs text-slate-500">Water Availability</p>

            <p className="mt-1 text-xl font-semibold text-slate-800">
              {locationData.waterAvailability}
            </p>
          </div>

          <div className="p-5">
            <p className="text-xs text-slate-500">Protected Area Nearby</p>

            <p className="mt-1 text-xl font-semibold text-slate-800">
              {locationData.protectedAreaNearby ? "Yes" : "No"}
            </p>
          </div>

          <div className="border-t border-slate-200 p-5">
            <p className="text-xs text-slate-500">Nearest Water Body</p>

            <p className="mt-1 text-lg font-semibold text-slate-800">
              {locationData.nearestWaterBody}
            </p>
          </div>

          <div className="border-t border-slate-200 p-5">
            <p className="text-xs text-slate-500">
              Nearest Residential Area
            </p>

            <p className="mt-1 text-lg font-semibold text-slate-800">
              {locationData.nearestResidentialArea}
            </p>
          </div>

          <div className="border-t border-slate-200 p-5">
            <p className="text-xs text-slate-500">Land Use</p>

            <p className="mt-1 text-lg font-semibold text-slate-800">
              {locationData.landUse}
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <div className="flex items-center justify-between border border-slate-200 bg-white px-6 py-4">
        <button className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
          <ArrowLeft size={16} />
          Back to Project Details
        </button>

        <button className="flex items-center gap-2 rounded-md bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800">
          Continue to Environmental Inputs
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}