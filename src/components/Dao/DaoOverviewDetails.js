import React from 'react';
import { useHistory } from 'react-router-dom';
import { Text, Box, Flex, Image } from '@chakra-ui/core';
import { utils } from 'web3';

import { useTheme, useUser, useMembers } from '../../contexts/PokemolContext';
import { PrimaryButton, SecondaryButton } from '../../themes/theme';

const DaoOverviewDetails = ({ dao }) => {
  const [theme] = useTheme();
  const [user] = useUser();
  const [members] = useMembers();
  const history = useHistory();
  // console.log(members);
  const wethBalance = dao?.graphData?.tokenBalances?.filter((t) => {
    return t.symbol === 'WETH';
  })[0].tokenBalance;

  return (
    <>
      {user && (
        <Text
          ml={6}
          textTransform='uppercase'
          fontSize='sm'
          fontFamily={theme.fonts.heading}
        >
          Details
        </Text>
      )}
      <Box
        rounded='lg'
        bg='blackAlpha.600'
        borderWidth='1px'
        borderColor='whiteAlpha.200'
        p={6}
        m={6}
        mt={2}
        w='100%'
      >
        <Flex direction='row' align='center'>
          <Image
            src={require('../../assets/Daohaus__Castle--Dark.svg')}
            alt='DAO Logo'
            h={50}
            w={50}
          />
          <Text
            ml={6}
            fontSize='2xl'
            fontWeight={700}
            fontFamily={theme.fonts.heading}
          >
            {dao?.apiMeta?.name ? dao.apiMeta.name : 'Braid Guild'}
          </Text>
        </Flex>
        <Flex direction='row' w='60%' justify='space-between' mt={6}>
          <Box>
            <Text
              textTransform='uppercase'
              fontFamily={theme.fonts.heading}
              fontSize='sm'
              fontWeight={700}
            >
              {theme.daoMeta.members}
            </Text>
            <Text
              fontSize='2xl'
              fontFamily={theme.fonts.heading}
              fontWeight={700}
            >
              {members?.length > 0 ? members.length : '-'}
            </Text>
          </Box>
          <Box>
            <Text
              textTransform='uppercase'
              fontFamily={theme.fonts.heading}
              fontSize='sm'
              fontWeight={700}
            >
              Shares
            </Text>
            <Text
              fontSize='2xl'
              fontFamily={theme.fonts.heading}
              fontWeight={700}
            >
              {dao?.graphData?.totalShares ? dao.graphData.totalShares : 0}
            </Text>
          </Box>
          <Box>
            <Text
              textTransform='uppercase'
              fontFamily={theme.fonts.heading}
              fontSize='sm'
              fontWeight={700}
            >
              Loot
            </Text>
            <Text
              fontSize='2xl'
              fontFamily={theme.fonts.heading}
              fontWeight={700}
            >
              {dao?.graphData?.totalLoot ? dao.graphData.totalLoot : 0}
            </Text>
          </Box>
        </Flex>
        <Box mt={6}>
          <Text
            fontFamily={theme.fonts.heading}
            textTransform='uppercase'
            fontSize='sm'
            fontWeight={700}
          >
            {theme.daoMeta.bank}
          </Text>
          <Text
            fontSize='3xl'
            fontFamily={theme.fonts.heading}
            fontWeight={700}
          >
            {wethBalance
              ? parseFloat(utils.fromWei(wethBalance)).toFixed(3)
              : '-'}{' '}
            WETH
          </Text>
          <Text fontSize='sm' as='i' fontWeight={200}>
            {dao?.graphData?.tokenBalances
              ? dao.graphData.tokenBalances.length
              : '-'}{' '}
            Tokens
          </Text>
        </Box>
        <Box mt={6}>
          {dao?.apiMeta?.description
            ? dao.apiMeta.description
            : 'A sing-a-long guild'}
        </Box>
        <Flex mt={6}>
          <PrimaryButton
            mr={6}
            onClick={() => history.push(`/dao/${dao.address}/proposals`)}
          >
            View {theme.daoMeta.proposals}
          </PrimaryButton>
          <SecondaryButton
            onClick={() => history.push(`/dao/${dao.address}/bank`)}
          >
            View {theme.daoMeta.bank}
          </SecondaryButton>
        </Flex>
      </Box>
    </>
  );
};

export default DaoOverviewDetails;