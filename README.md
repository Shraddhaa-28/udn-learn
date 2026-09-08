# UDN Lab

Interactive visual classroom for **OpenShift User Defined Networks**.

Ten sessions. Drawings you click. Packets you send. Quizzes that actually fail.

## Open it

**Live classroom:** https://shraddhaa-28.github.io/udn-learn/

Or run it locally from this folder:

```bash
python3 -m http.server 8765
```

Then go to **http://localhost:8765**, or open `index.html` in a browser.

Progress is saved in localStorage on this machine.

## Sessions

0. Intro & guide — how to use the classroom
1. Why UDN exists — one shared hallway
2. Island model — overlapping CIDRs, no path
3. Primary vs secondary NIC
4. UDN vs ClusterUserDefinedNetwork
5. Layer 2 / Layer 3 / Localnet
6. Implementation order (and the trap)
7. DNS, registry, NetworkPolicy gotchas
8. Virtual machines and live migration
9. ClusterNetworkConnect
10. TE decision tree
★ You did it — call checklist and a cheer

## Docs this is based on

The Ask a doubt helper answers from a local copy of these docs (`assets/udn-knowledge.js`):

- [OpenShift 4.22 primary / user-defined networks](https://docs.redhat.com/en/documentation/openshift_container_platform/4.22/html/multiple_networks/primary-networks)
- [OKD understanding multiple networks](https://docs.okd.io/latest/networking/multiple_networks/understanding-multiple-networks.html)
- [OpenShift 4.22 Virtualization networking](https://docs.redhat.com/en/documentation/openshift_container_platform/4.22/html/virtualization/networking)
- [ClusterUserDefinedNetwork API](https://docs.redhat.com/en/documentation/openshift_container_platform/4.22/html/network_apis/clusteruserdefinednetwork-k8s-ovn-org-v1)
- [OVN-Kubernetes ClusterNetworkConnect](https://ovn-kubernetes.io/features/user-defined-networks/cluster-network-connect/)
- [OVN-Kubernetes UDN OKEP](https://ovn-kubernetes.io/master/okeps/okep-5193-user-defined-networks/)

Built for a Red Hat OpenShift technical engineer learning UDN from scratch.
