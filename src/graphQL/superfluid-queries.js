import { gql } from 'apollo-boost';

export const SUPERFLUID_MINION_STREAMS = gql`
  query minionStream($minionId: String!) {
    minionStreams(where: { minion: $minionId }) {
      id
      createdAt
      proposalId
      to
      executed
      execTxHash
      tokenAddress
      superTokenAddress
      rate
      minDeposit
      executed
      active
    }
  }
`;
