import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-routing-machine";

const RoutingMachine = ({ from, to }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const routingControl = L.Routing.control({
      waypoints: [L.latLng(from[0], from[1]), L.latLng(to[0], to[1])],
      routeWhileDragging: true,
      createMarker: () => null,
    }).addTo(map);

    return () => map.removeControl(routingControl);
  }, [map, from, to]);

  return null;
};

export default RoutingMachine;
