import React, { useState, useEffect } from 'react';
import { formatDistanceToNow, isBefore } from 'date-fns';
import { Flex, Box, Icon, Link, Skeleton } from '@chakra-ui/core';
import { RiExternalLinkLine } from 'react-icons/ri';
import { FaThumbsUp, FaThumbsDown } from 'react-icons/fa';
import { utils } from 'web3';

import { useMembers, useMemberWallet } from '../../contexts/PokemolContext';
import { useTheme } from '../../contexts/CustomThemeContext';
import UserAvatar from '../../components/Shared/UserAvatar';
import { memberProfile } from '../../utils/helpers';
import { getProposalCountdownText } from '../../utils/proposal-helper';

const ProposalDetail = ({ proposal }) => {
  const [members] = useMembers();
  const [theme] = useTheme();
  const details = proposal?.details && JSON.parse(proposal?.details);
  const [memberWallet] = useMemberWallet();
  const [memberVote, setMemberVote] = useState();

  useEffect(() => {
    if (proposal?.votes && memberWallet && memberWallet?.activeMember) {
      setMemberVote(
        proposal.votes.find(
          (vote) =>
            vote.memberAddress === memberWallet.memberAddress.toLowerCase(),
        ),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberWallet, proposal]);

  return (
    <Box
      rounded='lg'
      bg='blackAlpha.600'
      borderWidth='1px'
      borderColor='whiteAlpha.200'
      p={6}
      m={6}
    >
      <Flex>
        <Box w='90%'>
          <Box
            textTransform='uppercase'
            fontSize='sm'
            fontFamily='heading'
            fontWeight={700}
          >
            {proposal ? proposal.proposalType : theme.daoMeta.proposal}
          </Box>
          <Skeleton isLoaded={details?.title}>
            <Box fontSize='3xl' fontFamily='heading' fontWeight={700}>
              {details?.title ? details?.title : '-'}
            </Box>
          </Skeleton>
          <Flex w='100%' justify='space-between' mt={6}>
            {(proposal?.tributeOffered > 0 || !proposal?.tributeOffered) && (
              <Box>
                <Box
                  textTransform='uppercase'
                  fontSize='sm'
                  fontFamily='heading'
                  fontWeight={700}
                >
                  Tribute
                </Box>
                <Skeleton isLoaded={proposal?.tributeOffered}>
                  <Box fontSize='lg' fontFamily='space' fontWeight={700}>
                    {proposal?.tributeOffered
                      ? `${utils.fromWei(
                          proposal.tributeOffered.toString(),
                        )} ${proposal.tributeTokenSymbol || 'WETH'}`
                      : '--'}
                  </Box>
                </Skeleton>
              </Box>
            )}
            {proposal?.paymentRequested > 0 && ( // don't show during loading
              <Box>
                <Box
                  textTransform='uppercase'
                  fontSize='sm'
                  fontFamily='heading'
                  fontWeight={700}
                >
                  Payment Requested
                </Box>
                <Skeleton isLoaded={proposal?.paymentRequested}>
                  <Box fontSize='lg' fontFamily='space' fontWeight={700}>
                    {proposal?.paymentRequested
                      ? `${utils.fromWei(
                          proposal.paymentRequested.toString(),
                        )} ${proposal.paymentTokenSymbol || 'WETH'}`
                      : '--'}
                  </Box>
                </Skeleton>
              </Box>
            )}
            {(proposal?.sharesRequested > 0 || !proposal?.sharesRequested) && (
              <Box>
                <Box
                  textTransform='uppercase'
                  fontSize='sm'
                  fontFamily='heading'
                  fontWeight={700}
                >
                  Shares
                </Box>
                <Skeleton isLoaded={proposal?.sharesRequested}>
                  <Box fontSize='lg' fontFamily='space' fontWeight={700}>
                    {proposal?.sharesRequested
                      ? proposal.sharesRequested
                      : '--'}
                  </Box>
                </Skeleton>
              </Box>
            )}
            {proposal?.lootRequested > 0 && ( // don't show during loading
              <Box>
                <Box
                  textTransform='uppercase'
                  fontSize='sm'
                  fontFamily='heading'
                  fontWeight={700}
                >
                  Loot
                </Box>
                <Skeleton isLoaded={proposal?.lootRequested}>
                  <Box fontSize='lg' fontFamily='space' fontWeight={700}>
                    {proposal?.lootRequested ? proposal.lootRequested : '--'}
                  </Box>
                </Skeleton>
              </Box>
            )}
            <Box>
              {proposal?.proposalIndex ? (
                <>
                  <Box
                    textTransform='uppercase'
                    fontSize='sm'
                    fontFamily='heading'
                    fontWeight={700}
                  >
                    {isBefore(
                      Date.now(),
                      new Date(+proposal?.votingPeriodEnds * 1000),
                    )
                      ? 'Voting Period Ends'
                      : 'Voting Ended'}
                  </Box>
                  <Box fontSize='lg' fontFamily='space' fontWeight={700}>
                    {formatDistanceToNow(
                      new Date(+proposal?.votingPeriodEnds * 1000),
                      {
                        addSuffix: true,
                      },
                    )}
                  </Box>
                </>
              ) : (
                <>
                  <Box
                    textTransform='uppercase'
                    fontSize='sm'
                    fontFamily='heading'
                    fontWeight={700}
                  >
                    Proposal Status
                  </Box>
                  <Skeleton isLoaded={proposal?.status}>
                    <Box fontSize='lg' fontFamily='space' fontWeight={700}>
                      {proposal?.status
                        ? getProposalCountdownText(proposal)
                        : '--'}
                    </Box>
                  </Skeleton>
                </>
              )}
            </Box>
          </Flex>
          <Box mt={6}>
            <Box
              textTransform='uppercase'
              fontSize='sm'
              fontFamily='heading'
              fontWeight={700}
            >
              Link
            </Box>
            <Skeleton isLoaded={details?.link}>
              <Link href={details?.link} target='_blank'>
                {details?.link ? details.link : '-'}{' '}
                <Icon as={RiExternalLinkLine} color='primary.50' />
              </Link>
            </Skeleton>
          </Box>
        </Box>
        <Flex>
          {memberVote &&
            (+memberVote.uintVote === 1 ? (
              <Flex
                pl={6}
                w='40px'
                borderColor='secondary.500'
                borderWidth='2px'
                borderStyle='solid'
                borderRadius='40px'
                p={1}
                h='40px'
                justify='center'
                align='center'
                m='0 auto'
              >
                <Icon as={FaThumbsUp} color='secondary.500' />
              </Flex>
            ) : (
              <Flex
                pl={6}
                w='40px'
                borderColor='secondary.500'
                borderWidth='2px'
                borderStyle='solid'
                borderRadius='40px'
                p={1}
                h='40px'
                justify='center'
                align='center'
                m='0 auto'
              >
                <Icon as={FaThumbsDown} color='secondary.500' />
              </Flex>
            ))}
        </Flex>
      </Flex>
      <Skeleton isLoaded={details?.description}>
        <Box w='100%' mt={8}>
          {details?.description}
        </Box>
      </Skeleton>

      <Flex w='80%' mt={6} justify='space-between'>
        <Box mr={5}>
          <Box
            textTransform='uppercase'
            fontSize='sm'
            mb={4}
            fontFamily='heading'
            fontWeight={700}
          >
            Submitted By
          </Box>
          <Skeleton isLoaded={members && proposal?.proposer}>
            {members && proposal?.proposer ? (
              <UserAvatar
                user={memberProfile(members, proposal?.proposer).profile}
              />
            ) : (
              '--'
            )}
          </Skeleton>
        </Box>
        <Box>
          <Box
            textTransform='uppercase'
            fontSize='sm'
            fontFamily='heading'
            fontWeight={700}
            mb={4}
          >
            Recipient
          </Box>
          <Skeleton isLoaded={members && proposal?.applicant}>
            {members && proposal?.applicant ? (
              <UserAvatar
                user={memberProfile(members, proposal?.applicant).profile}
              />
            ) : (
              '--'
            )}
          </Skeleton>
        </Box>
      </Flex>
    </Box>
  );
};

export default ProposalDetail;
